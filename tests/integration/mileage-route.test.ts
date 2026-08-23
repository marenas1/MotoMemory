import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMileage } = vi.hoisted(() => ({
  updateMileage: vi.fn(),
}));

vi.mock("@/lib/data/motorcycle-repository", () => ({
  motorcycleRepository: { updateMileage },
}));

import { PATCH } from "@/app/api/motorcycle/mileage/route";

describe("Phase 1 mileage route preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(updateMileage).toHaveBeenCalledWith("gs750", 17_000, 18_501);
    await expect(response.json()).resolves.toMatchObject({
      motorcycle: { currentMileage: 17_000 },
    });
  });
});
