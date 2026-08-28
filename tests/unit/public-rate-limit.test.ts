import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDeterministicTestClientIpResolver,
  normalizeClientIp,
  resolveTrustedClientIp,
} from "@/lib/server/client-ip";
import {
  fixedWindowDecision,
  getPublicRateLimitConfig,
  enforcePublicRateLimit,
} from "@/lib/server/public-rate-limit";

// Keep the rate-limit policy tests independent from PostgreSQL. The migration
// tests the shared atomic store; these tests prove the route-side contract and
// trusted-IP normalization at the deterministic boundary.
describe("public abuse boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["manual_search", 60],
    ["manual_question", 10],
    ["manual_pdf", 120],
  ] as const)("keeps the configured %s starting limit", (routeClass, limit) => {
    expect(getPublicRateLimitConfig(routeClass).limit).toBe(limit);
    expect(getPublicRateLimitConfig(routeClass).windowSeconds).toBe(60);
  });

  it.each([
    [0, 60, true, 1],
    [59, 60, true, 60],
    [60, 60, false, 60],
  ] as const)("handles the search fixed-window boundary at request count %s", (count, limit, allowed, nextCount) => {
    const decision = fixedWindowDecision({
      windowStartedAtMs: 1_000,
      nowMs: 1_000 + 30_000,
      requestCount: count,
      limit,
    });
    expect(decision.allowed).toBe(allowed);
    expect(decision.requestCount).toBe(nextCount);
    if (!allowed) expect(decision.retryAfterSeconds).toBe(30);
  });

  it.each([
    ["manual_question", 10],
    ["manual_pdf", 120],
  ] as const)("applies the %s count without changing the fixed window", (_routeClass, limit) => {
    expect(
      fixedWindowDecision({
        windowStartedAtMs: 0,
        nowMs: 59_999,
        requestCount: limit - 1,
        limit,
      }),
    ).toMatchObject({ allowed: true, requestCount: limit });
    expect(
      fixedWindowDecision({
        windowStartedAtMs: 0,
        nowMs: 60_000,
        requestCount: limit,
        limit,
      }),
    ).toMatchObject({ allowed: true, requestCount: 1, retryAfterSeconds: 0 });
  });

  it("uses a deterministic test resolver without trusting arbitrary headers", () => {
    const resolver = createDeterministicTestClientIpResolver("2001:0db8:0:0:0:0:0:1");
    expect(resolver(new Request("http://localhost", { headers: { "x-real-ip": "203.0.113.9" } }))).toBe("2001:db8::1");
    expect(normalizeClientIp("192.168.1.10")).toBe("192.168.1.10");
    expect(normalizeClientIp("::ffff:192.0.2.1")).toBe("::ffff:c000:201");
  });

  it("requires the configured trusted production header and rejects spoofable alternatives", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOTOMEMORY_TRUSTED_CLIENT_IP_HEADER", "x-forwarded-for");

    expect(() => resolveTrustedClientIp(new Request("https://showcase.example", {
      headers: { "x-real-ip": "203.0.113.9" },
    }))).toThrow(/trusted client IP/i);
    expect(resolveTrustedClientIp(new Request("https://showcase.example", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    }))).toBe("203.0.113.9");
    expect(() => resolveTrustedClientIp(new Request("https://showcase.example", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    }))).toThrow(/trusted client IP/i);
  });

  it("turns a shared-store cooldown decision into a numeric 429 contract", async () => {
    const store = {
      consume: vi.fn().mockResolvedValue({
        allowed: false,
        retryAfterSeconds: 300,
        throttled: true,
        requestCount: 60,
      }),
    };

    await expect(
      enforcePublicRateLimit(
        new Request("http://localhost"),
        "manual_search",
        {
          resolver: createDeterministicTestClientIpResolver(),
          store,
          config: {
            limit: 60,
            windowSeconds: 60,
            cooldownSeconds: 300,
            throttleAfterViolations: 3,
          },
        },
      ),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      retryAfterSeconds: 300,
    });
    expect(store.consume).toHaveBeenCalledWith(
      "198.51.100.1",
      "manual_search",
      expect.objectContaining({ limit: 60, cooldownSeconds: 300 }),
    );
  });

  it("allows recovery after the shared cooldown expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T00:00:00.000Z"));
    let throttleUntil = Date.now() + 300_000;
    const store = {
      consume: vi.fn().mockImplementation(async () => {
        if (Date.now() < throttleUntil) {
          return {
            allowed: false,
            retryAfterSeconds: Math.ceil((throttleUntil - Date.now()) / 1000),
            throttled: true,
            requestCount: 60,
          };
        }
        return { allowed: true, retryAfterSeconds: 0, throttled: false, requestCount: 1 };
      }),
    };

    try {
      const options = {
        resolver: createDeterministicTestClientIpResolver(),
        store,
        config: getPublicRateLimitConfig("manual_search"),
      };
      await expect(
        enforcePublicRateLimit(new Request("http://localhost"), "manual_search", options),
      ).rejects.toMatchObject({ status: 429, retryAfterSeconds: 300 });
      vi.advanceTimersByTime(300_000);
      throttleUntil = Date.now();
      await expect(
        enforcePublicRateLimit(new Request("http://localhost"), "manual_search", options),
      ).resolves.toMatchObject({ allowed: true });
    } finally {
      vi.useRealTimers();
    }
  });
});
