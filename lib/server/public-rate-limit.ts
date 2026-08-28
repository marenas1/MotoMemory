import "server-only";

import { getDatabasePool } from "@/lib/data/database";
import { AppError } from "@/lib/server/errors";
import { resolveTrustedClientIp, type ClientIpResolver } from "@/lib/server/client-ip";

export type PublicRouteClass = "manual_search" | "manual_question" | "manual_pdf";

export interface PublicRateLimitConfig {
  limit: number;
  windowSeconds: number;
  cooldownSeconds: number;
  throttleAfterViolations: number;
}

export interface PublicRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  throttled: boolean;
  requestCount: number;
}

const ROUTE_CONFIGURATION: Record<PublicRouteClass, { env: string; fallback: number }> = {
  manual_search: { env: "MOTOMEMORY_PUBLIC_SEARCH_PER_MINUTE", fallback: 60 },
  manual_question: { env: "MOTOMEMORY_PUBLIC_QUESTION_PER_MINUTE", fallback: 10 },
  manual_pdf: { env: "MOTOMEMORY_PUBLIC_PDF_PER_MINUTE", fallback: 120 },
};

function boundedInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError("INVALID_CONFIGURATION", `The ${name} setting is invalid.`, 503);
  }
  return parsed;
}

export function getPublicRateLimitConfig(routeClass: PublicRouteClass): PublicRateLimitConfig {
  const route = ROUTE_CONFIGURATION[routeClass];
  return {
    limit: boundedInteger(route.env, route.fallback, 1, 10_000),
    windowSeconds: 60,
    cooldownSeconds: boundedInteger("MOTOMEMORY_PUBLIC_THROTTLE_SECONDS", 300, 60, 86_400),
    throttleAfterViolations: boundedInteger("MOTOMEMORY_PUBLIC_THROTTLE_AFTER_VIOLATIONS", 3, 2, 10),
  };
}

function rateLimited(retryAfterSeconds: number): AppError {
  const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return new AppError(
    "RATE_LIMITED",
    "Public manual requests are temporarily limited. Try again later.",
    429,
    { retryAfterSeconds: retryAfter },
  );
}

export interface PublicRateLimitStore {
  consume(
    clientIp: string,
    routeClass: PublicRouteClass,
    config: PublicRateLimitConfig,
  ): Promise<PublicRateLimitDecision>;
}

export const postgresPublicRateLimitStore: PublicRateLimitStore = {
  async consume(clientIp, routeClass, config) {
    const result = await getDatabasePool().query<PublicRateLimitDecision>(
      `select allowed,
              retry_after_seconds as "retryAfterSeconds",
              throttled,
              request_count as "requestCount"
         from public.consume_public_rate_limit($1::inet, $2, $3, $4, $5, $6)`,
      [
        clientIp,
        routeClass,
        config.limit,
        config.windowSeconds,
        config.cooldownSeconds,
        config.throttleAfterViolations,
      ],
    );
    const decision = result.rows[0];
    if (!decision) {
      throw new AppError("DATABASE_UNAVAILABLE", "The public abuse-control store is unavailable.", 503);
    }
    return decision;
  },
};

export async function enforcePublicRateLimit(
  request: Request,
  routeClass: PublicRouteClass,
  options: {
    resolver?: ClientIpResolver;
    store?: PublicRateLimitStore;
    config?: PublicRateLimitConfig;
  } = {},
): Promise<PublicRateLimitDecision> {
  const resolver = options.resolver ?? resolveTrustedClientIp;
  const clientIp = resolver(request);
  const config = options.config ?? getPublicRateLimitConfig(routeClass);
  const decision = await (options.store ?? postgresPublicRateLimitStore).consume(
    clientIp,
    routeClass,
    config,
  );
  if (!decision.allowed) {
    throw rateLimited(decision.retryAfterSeconds);
  }
  return decision;
}

export function fixedWindowDecision(input: {
  windowStartedAtMs: number;
  nowMs: number;
  requestCount: number;
  limit: number;
  windowSeconds?: number;
}): PublicRateLimitDecision {
  const windowSeconds = input.windowSeconds ?? 60;
  const windowEndsAt = input.windowStartedAtMs + windowSeconds * 1000;
  if (input.nowMs >= windowEndsAt) {
    return { allowed: true, retryAfterSeconds: 0, throttled: false, requestCount: 1 };
  }
  if (input.requestCount >= input.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowEndsAt - input.nowMs) / 1000)),
      throttled: false,
      requestCount: input.requestCount,
    };
  }
  return {
    allowed: true,
    retryAfterSeconds: 0,
    throttled: false,
    requestCount: input.requestCount + 1,
  };
}
