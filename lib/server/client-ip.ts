import "server-only";

import { isIP } from "node:net";

import { AppError } from "@/lib/server/errors";

export const DEFAULT_TRUSTED_CLIENT_IP_HEADER = "x-forwarded-for";
export const DEFAULT_TEST_CLIENT_IP = "198.51.100.1";

function invalidIp(): AppError {
  return new AppError(
    "INVALID_CONFIGURATION",
    "A trusted client IP is unavailable for this public request.",
    503,
  );
}

function normalizeIpv4(value: string): string {
  const parts = value.split(".");
  if (parts.length !== 4) throw invalidIp();
  const numbers = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) throw invalidIp();
    const number = Number(part);
    if (number > 255) throw invalidIp();
    return String(number);
  });
  return numbers.join(".");
}

function ipv4AsWords(value: string): number[] {
  const octets = normalizeIpv4(value).split(".").map(Number);
  return [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
}

function normalizeIpv6(value: string): string {
  if (value.includes("%")) throw invalidIp();
  let expandedValue = value;
  if (value.includes(".")) {
    const separator = value.lastIndexOf(":");
    if (separator < 0) throw invalidIp();
    const ipv4 = value.slice(separator + 1);
    expandedValue = `${value.slice(0, separator + 1)}${ipv4AsWords(ipv4)
      .map((word) => word.toString(16).padStart(4, "0"))
      .join(":")}`;
  }
  const halves = expandedValue.split("::");
  if (halves.length > 2) throw invalidIp();
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const parseWords = (words: string[]) => words.map((word) => {
    if (!/^[0-9a-f]{1,4}$/i.test(word)) throw invalidIp();
    return Number.parseInt(word, 16);
  });
  const parsedLeft = parseWords(left);
  const parsedRight = parseWords(right);
  const missing = 8 - parsedLeft.length - parsedRight.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) {
    throw invalidIp();
  }
  const words = halves.length === 2
    ? [...parsedLeft, ...Array.from({ length: missing }, () => 0), ...parsedRight]
    : [...parsedLeft, ...parsedRight];
  if (words.length !== 8) throw invalidIp();

  let bestStart = -1;
  let bestLength = 0;
  let currentStart = -1;
  for (let index = 0; index <= words.length; index += 1) {
    if (index < words.length && words[index] === 0) {
      currentStart = currentStart < 0 ? index : currentStart;
      continue;
    }
    if (currentStart >= 0 && index - currentStart > bestLength) {
      bestStart = currentStart;
      bestLength = index - currentStart;
    }
    currentStart = -1;
  }

  const groups: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    if (index === bestStart && bestLength > 1) {
      groups.push("");
      index += bestLength - 1;
      continue;
    }
    groups.push(words[index].toString(16));
  }
  const result = groups.join(":");
  return result === "" ? "::" : result.startsWith(":") ? `:${result}` : result.endsWith(":") ? `${result}:` : result;
}

export function normalizeClientIp(value: string): string {
  const candidate = value.trim();
  if (!candidate || isIP(candidate) === 0) throw invalidIp();
  return isIP(candidate) === 4 ? normalizeIpv4(candidate) : normalizeIpv6(candidate);
}

export type ClientIpResolver = (request: Request) => string;

export function createDeterministicTestClientIpResolver(
  value = process.env.MOTOMEMORY_TEST_CLIENT_IP ?? DEFAULT_TEST_CLIENT_IP,
): ClientIpResolver {
  const normalized = normalizeClientIp(value);
  return () => normalized;
}

export function resolveTrustedClientIp(request: Request): string {
  if (process.env.NODE_ENV !== "production" && process.env.MOTOMEMORY_CLIENT_IP_MODE !== "trusted_proxy") {
    return createDeterministicTestClientIpResolver()(request);
  }

  const configuredHeader = (
    process.env.MOTOMEMORY_TRUSTED_CLIENT_IP_HEADER ?? DEFAULT_TRUSTED_CLIENT_IP_HEADER
  ).trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(configuredHeader)) throw invalidIp();
  const value = request.headers.get(configuredHeader)?.trim() ?? "";
  // The proxy must overwrite this header with one normalized address. Taking
  // the first item in an arbitrary list would let callers spoof their bucket.
  if (!value || value.includes(",")) throw invalidIp();
  return normalizeClientIp(value);
}
