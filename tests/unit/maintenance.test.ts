import { describe, expect, it } from "vitest";

import {
  calculateMaintenanceOutlook,
  calculateMaintenanceOutlooks,
} from "../../lib/domain/maintenance";
import type {
  MaintenanceDefinition,
  MaintenanceRecord,
} from "../../lib/domain/types";

const definition: MaintenanceDefinition = {
  id: "maintenance-1",
  motorcycleId: "gs750",
  name: "General maintenance check",
  intervalValue: 4000,
  intervalUnit: "mi",
  intervalMiles: 4000,
  dueWindowMiles: 4000,
  status: "active",
  source: "manual_ocr",
  sourceManualId: "manual-1",
  sourcePageStart: 42,
  sourcePageEnd: 42,
  sourcePrintedPageLabel: "38",
  rawOcrContext: "General maintenance check every 4,000 miles",
  sourceHref: "/manual?page=42&printedPage=38",
  notes: null,
};

function record(
  overrides: Partial<MaintenanceRecord> = {},
): MaintenanceRecord {
  return {
    id: "record-1",
    motorcycleId: "gs750",
    definitionId: definition.id,
    serviceType: definition.name,
    performedMileage: 18_000,
    performedAt: null,
    notes: null,
    parts: null,
    cost: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateMaintenanceOutlook", () => {
  it("keeps no history distinct from overdue and hides a personalized target", () => {
    expect(calculateMaintenanceOutlook(22_001, definition)).toMatchObject({
      currentMileage: 22_001,
      intervalMiles: 4000,
      lastServiceRecordId: null,
      lastServiceMileage: null,
      dueMileage: null,
      remainingMiles: null,
      status: "not_recorded",
      sourceManualId: "manual-1",
      sourcePageStart: 42,
      rawOcrContext: "General maintenance check every 4,000 miles",
      sourceHref: "/manual?page=42&printedPage=38",
    });
  });

  it.each([
    {
      currentMileage: 19_700,
      expected: { dueMileage: 22_000, remainingMiles: 2300, status: "upcoming" },
    },
    {
      currentMileage: 22_000,
      expected: { dueMileage: 22_000, remainingMiles: 0, status: "due" },
    },
    {
      currentMileage: 22_001,
      expected: { dueMileage: 22_000, remainingMiles: -1, status: "overdue" },
    },
  ])("calculates $expected.status from the latest service", ({ currentMileage, expected }) => {
    expect(calculateMaintenanceOutlook(currentMileage, definition, [record()])).toMatchObject({
      ...expected,
      currentMileage,
      lastServiceRecordId: "record-1",
      lastServiceMileage: 18_000,
    });
  });

  it("selects the latest recorded mileage independently of insertion order", () => {
    const older = record({ id: "record-older", performedMileage: 17_000 });
    const newer = record({ id: "record-newer", performedMileage: 18_500 });

    const firstOrder = calculateMaintenanceOutlook(19_000, definition, [older, newer]);
    const secondOrder = calculateMaintenanceOutlook(19_000, definition, [newer, older]);

    expect(firstOrder).toEqual(secondOrder);
    expect(firstOrder).toMatchObject({
      lastServiceRecordId: "record-newer",
      lastServiceMileage: 18_500,
      dueMileage: 22_500,
      remainingMiles: 3500,
      status: "upcoming",
    });
  });

  it("uses a stable record identity for equal mileage events", () => {
    const first = record({ id: "record-a", performedMileage: 18_000 });
    const second = record({ id: "record-b", performedMileage: 18_000 });

    expect(calculateMaintenanceOutlook(19_000, definition, [second, first])).toMatchObject({
      lastServiceRecordId: "record-b",
      lastServiceMileage: 18_000,
    });
  });

  it("recalculates when current mileage changes", () => {
    const history = [record()];

    expect(calculateMaintenanceOutlook(19_700, definition, history).status).toBe("upcoming");
    expect(calculateMaintenanceOutlook(22_000, definition, history).status).toBe("due");
    expect(calculateMaintenanceOutlook(22_001, definition, history).status).toBe("overdue");
  });

  it("returns unknown for invalid current mileage or interval", () => {
    expect(calculateMaintenanceOutlook(null, definition, [record()])).toMatchObject({
      currentMileage: null,
      intervalMiles: null,
      dueMileage: null,
      status: "unknown",
    });
    expect(
      calculateMaintenanceOutlook(19_000, { ...definition, intervalMiles: 0 }, [record()]),
    ).toMatchObject({ status: "unknown", dueMileage: null, intervalMiles: null });
  });

  it("returns unknown for unusable mappings and inconsistent history", () => {
    expect(
      calculateMaintenanceOutlook(19_000, definition, [
        record({ motorcycleId: "another-motorcycle" }),
      ]),
    ).toMatchObject({ status: "unknown", dueMileage: null });

    expect(
      calculateMaintenanceOutlook(19_000, definition, [
        record({ performedMileage: 19_001 }),
      ]),
    ).toMatchObject({
      status: "unknown",
      lastServiceRecordId: null,
      lastServiceMileage: null,
      dueMileage: null,
    });
  });

  it("does not use unlinked service history for a manual item", () => {
    expect(
      calculateMaintenanceOutlook(19_000, definition, [
        record({ definitionId: null, serviceType: "Other repair" }),
      ]),
    ).toMatchObject({ status: "not_recorded", dueMileage: null });
  });

  it("recalculates a corrected interval without changing definition or source identity", () => {
    const correctedDefinition = {
      ...definition,
      intervalValue: 2500,
      intervalMiles: 2500,
      origin: "rider_corrected" as const,
      correctedAt: "2026-02-01T00:00:00.000Z",
    };

    const before = calculateMaintenanceOutlook(20_000, definition, [record()]);
    const after = calculateMaintenanceOutlook(20_000, correctedDefinition, [record()]);

    expect(before).toMatchObject({ definitionId: definition.id, dueMileage: 22_000 });
    expect(after).toMatchObject({
      definitionId: definition.id,
      intervalMiles: 2500,
      dueMileage: 20_500,
      remainingMiles: 500,
      status: "upcoming",
      sourceManualId: definition.sourceManualId,
      sourcePageStart: definition.sourcePageStart,
      rawOcrContext: definition.rawOcrContext,
      sourceHref: definition.sourceHref,
    });
    expect(after.lastServiceRecordId).toBe(before.lastServiceRecordId);
  });

  it("calculates every definition against the shared history set", () => {
    const secondDefinition = { ...definition, id: "maintenance-2", name: "Valve check" };
    expect(
      calculateMaintenanceOutlooks(19_000, [definition, secondDefinition], [record()]),
    ).toMatchObject([
      { status: "upcoming", lastServiceRecordId: "record-1" },
      { status: "not_recorded", dueMileage: null },
    ]);
  });
});
