import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertMutationMode,
  READ_ONLY_MODE_MESSAGE,
  requireOwnerMode,
} from "@/lib/server/mutation-guard";
import { resolveRuntimeMode } from "@/lib/server/runtime-mode";

describe("runtime mode boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables owner mode only when explicitly configured outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MOTOMEMORY_RUNTIME_MODE", "owner");

    expect(resolveRuntimeMode()).toBe("owner");
    expect(requireOwnerMode()).toBe("owner");
    expect(() => assertMutationMode()).not.toThrow();
  });

  it("accepts explicit readonly mode", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MOTOMEMORY_RUNTIME_MODE", "readonly");

    expect(resolveRuntimeMode()).toBe("readonly");
    expect(() => requireOwnerMode()).toThrowError(
      expect.objectContaining({
        code: "READ_ONLY_MODE",
        status: 403,
        message: READ_ONLY_MODE_MESSAGE,
      }),
    );
  });

  it("defaults to readonly when the mode is omitted", () => {
    vi.stubEnv("NODE_ENV", "development");
    const originalMode = process.env.MOTOMEMORY_RUNTIME_MODE;
    delete process.env.MOTOMEMORY_RUNTIME_MODE;

    try {
      expect(resolveRuntimeMode()).toBe("readonly");
      expect(() => assertMutationMode()).toThrowError(
        expect.objectContaining({ code: "READ_ONLY_MODE", status: 403 }),
      );
    } finally {
      if (originalMode === undefined) {
        delete process.env.MOTOMEMORY_RUNTIME_MODE;
      } else {
        process.env.MOTOMEMORY_RUNTIME_MODE = originalMode;
      }
    }
  });

  it.each(["", "OWNER", "owner ", "read-only", "staging"])(
    "fails closed for malformed mode %s",
    (configuredMode) => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("MOTOMEMORY_RUNTIME_MODE", configuredMode);

      expect(resolveRuntimeMode()).toBe("readonly");
      expect(() => assertMutationMode()).toThrowError(
        expect.objectContaining({ code: "READ_ONLY_MODE", status: 403 }),
      );
    },
  );

  it("forces owner configuration to readonly in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOTOMEMORY_RUNTIME_MODE", "owner");

    expect(resolveRuntimeMode()).toBe("readonly");
    expect(() => requireOwnerMode()).toThrowError(
      expect.objectContaining({ code: "READ_ONLY_MODE", status: 403 }),
    );
  });

  it("does not accept request-controlled mode overrides", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOTOMEMORY_RUNTIME_MODE", "owner");

    const requestInputs = [
      new Request("https://example.test/?MOTOMEMORY_RUNTIME_MODE=owner", {
        headers: {
          cookie: "MOTOMEMORY_RUNTIME_MODE=owner",
          "x-motomemory-runtime-mode": "owner",
        },
        method: "POST",
        body: "{\"MOTOMEMORY_RUNTIME_MODE\":\"owner\"}",
      }),
      {
        headers: { "x-motomemory-runtime-mode": "owner" },
        query: { MOTOMEMORY_RUNTIME_MODE: "owner" },
        cookies: { MOTOMEMORY_RUNTIME_MODE: "owner" },
        body: { MOTOMEMORY_RUNTIME_MODE: "owner" },
      },
    ];

    // The resolver has no request parameter. These attacker-controlled values
    // cannot alter the process-wide production decision.
    for (const _requestInput of requestInputs) {
      expect(resolveRuntimeMode()).toBe("readonly");
    }
    expect(resolveRuntimeMode.length).toBe(0);
  });
});
