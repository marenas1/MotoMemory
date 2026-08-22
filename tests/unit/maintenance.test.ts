import { describe, expect, it } from "vitest";

import { calculateMaintenanceOutlook } from "../../lib/domain/maintenance";
import type { MaintenanceDefinition } from "../../lib/domain/types";

const definition: MaintenanceDefinition = {
  id: "maintenance-1",
  motorcycleId: "gs750",
  name: "General maintenance check",
  intervalMiles: 1000,
  dueWindowMiles: 1000,
  status: "active",
  source: "phase1_configured",
  notes: null,
};

describe("calculateMaintenanceOutlook", () => {
  it("calculates the seeded mileage outlook", () => {
    expect(calculateMaintenanceOutlook(18501, definition)).toMatchObject({
      dueMileage: 19000,
      remainingMiles: 499,
      status: "upcoming",
    });
  });

  it("marks an exact boundary as due", () => {
    expect(calculateMaintenanceOutlook(19000, definition)).toMatchObject({
      dueMileage: 19000,
      remainingMiles: 0,
      status: "due",
    });
  });

  it("does not invent an overdue state without service history", () => {
    expect(calculateMaintenanceOutlook(19001, definition).status).toBe(
      "upcoming",
    );
  });

  it("returns unknown for invalid configuration", () => {
    expect(
      calculateMaintenanceOutlook(18501, { ...definition, intervalMiles: 0 }),
    ).toMatchObject({ status: "unknown", dueMileage: null });
  });
});
