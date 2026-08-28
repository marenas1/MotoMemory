import { afterEach, describe, expect, it, vi } from "vitest";

const { resolveRuntimeMode } = vi.hoisted(() => ({ resolveRuntimeMode: vi.fn() }));

vi.mock("@/lib/server/runtime-mode", () => ({ resolveRuntimeMode }));

import { getPublicReadScope, getReadableScope } from "@/lib/server/read-access";
import { OWNER_SCOPE } from "@/lib/server/owner-scope";

describe("server read access", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses the fixed owner scope for local owner reads", async () => {
    resolveRuntimeMode.mockReturnValue("owner");

    await expect(getReadableScope()).resolves.toEqual({
      scope: OWNER_SCOPE,
      isOwner: true,
    });
  });

  it("uses a separate live-read scope in readonly mode", async () => {
    resolveRuntimeMode.mockReturnValue("readonly");

    const access = await getReadableScope();

    expect(access).toEqual({ scope: getPublicReadScope(), isOwner: false });
    expect(access.scope).not.toBe(OWNER_SCOPE);
    expect(access.scope.motorcycleId).toBe("gs750");
  });
});
