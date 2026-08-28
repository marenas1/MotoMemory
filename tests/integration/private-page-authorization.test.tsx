import { beforeEach, describe, expect, it, vi } from "vitest";

const readAccess = vi.hoisted(() => ({ getReadableScope: vi.fn() }));

vi.mock("@/lib/server/read-access", () => readAccess);
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
import ManualPage from "@/app/manual/page";
import { TEST_SCOPE } from "@/tests/fixtures/test-scope";

describe("runtime mode page boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the manual page from the live read scope without owner authentication", async () => {
    readAccess.getReadableScope.mockResolvedValue({ scope: TEST_SCOPE, isOwner: false });

    const page = await ManualPage({ searchParams: Promise.resolve({}) });

    expect(page).toBeTruthy();
    expect(readAccess.getReadableScope).toHaveBeenCalledOnce();
  });
});
