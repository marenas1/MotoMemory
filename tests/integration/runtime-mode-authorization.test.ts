import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOwnerMode } = vi.hoisted(() => ({ requireOwnerMode: vi.fn() }));
const { updateMileage } = vi.hoisted(() => ({ updateMileage: vi.fn() }));

vi.mock("@/lib/server/mutation-guard", () => ({ requireOwnerMode }));
vi.mock("@/lib/data/motorcycle-repository", () => ({
  motorcycleRepository: { updateMileage },
}));

import { PATCH as patchMileage } from "@/app/api/motorcycle/mileage/route";
import { AppError } from "@/lib/server/errors";
import { OWNER_SCOPE } from "@/lib/server/owner-scope";

function request(): Request {
  return new Request("http://localhost/api/motorcycle/mileage", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mileage: 18_501 }),
  });
}

describe("runtime mode mutation authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerMode.mockReturnValue(undefined);
    updateMileage.mockResolvedValue({
      motorcycle: { id: "gs750", currentMileage: 18_501 },
      maintenanceOutlook: [],
    });
  });

  it("allows local owner mode without authentication", async () => {
    const response = await patchMileage(request());

    expect(response.status).toBe(200);
    expect(requireOwnerMode).toHaveBeenCalledOnce();
    expect(updateMileage).toHaveBeenCalledWith(OWNER_SCOPE, 18_501, undefined);
  });

  it("rejects read-only mode before changing mileage", async () => {
    requireOwnerMode.mockImplementation(() => {
      throw new AppError("READ_ONLY_MODE", "read-only", 403);
    });

    const response = await patchMileage(request());

    expect(response.status).toBe(403);
    expect(updateMileage).not.toHaveBeenCalled();
  });
});
