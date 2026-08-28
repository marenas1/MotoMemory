import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMileage } = vi.hoisted(() => ({
  updateMileage: vi.fn(),
}));
const { requireOwnerMode } = vi.hoisted(() => ({
  requireOwnerMode: vi.fn(),
}));

vi.mock("@/lib/data/motorcycle-repository", () => ({
  motorcycleRepository: { updateMileage },
}));
vi.mock("@/lib/server/mutation-guard", () => ({ requireOwnerMode }));

import { OWNER_SCOPE } from "@/lib/server/owner-scope";
import { AppError } from "@/lib/server/errors";

import { PATCH } from "@/app/api/motorcycle/mileage/route";

describe("Phase 1 mileage route preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerMode.mockReturnValue(undefined);
    updateMileage.mockResolvedValue({
      motorcycle: {
        id: "gs750",
        currentMileage: 17_000,
      },
      maintenanceOutlook: [],
    });
  });

  it("continues to accept a lower manual correction through the original route", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/motorcycle/mileage", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mileage: "17000",
          expectedCurrentMileage: 18_501,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateMileage).toHaveBeenCalledWith(OWNER_SCOPE, 17_000, 18_501);
    await expect(response.json()).resolves.toMatchObject({
      motorcycle: { currentMileage: 17_000 },
    });
  });

  it("rejects a cross-origin mileage mutation without calling the repository", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/motorcycle/mileage", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
        },
        body: JSON.stringify({ mileage: 17_000 }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CSRF_FORBIDDEN" },
    });
    expect(updateMileage).not.toHaveBeenCalled();
  });

  it("rejects read-only mutations before reading the request body or repository", async () => {
    requireOwnerMode.mockImplementation(() => {
      throw new AppError(
        "READ_ONLY_MODE",
        "This MotoMemory deployment is read-only.",
        403,
      );
    });

    const response = await PATCH(
      new Request("http://localhost/api/motorcycle/mileage", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "READ_ONLY_MODE" },
    });
    expect(updateMileage).not.toHaveBeenCalled();
  });
});
