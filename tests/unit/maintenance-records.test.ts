import { describe, expect, it } from "vitest";

import {
  MaintenanceRecordValidationError,
  validateMaintenanceRecordInput,
  validateMaintenanceRecordUpdateInput,
  validatePerformedMileageAgainstCurrentMileage,
} from "@/lib/domain/maintenance-records";

describe("maintenance record validation", () => {
  it("normalizes a valid record and its optional metadata", () => {
    expect(
      validateMaintenanceRecordInput({
        definitionId: "definition-1",
        serviceType: "  Oil change  ",
        performedMileage: "18501.5",
        performedAt: "2025-01-02",
        notes: "  Used the owner-supplied filter. ",
        parts: ["  Oil filter ", "4 qt oil"],
        cost: "42.50",
      }),
    ).toEqual({
      definitionId: "definition-1",
      serviceType: "Oil change",
      performedMileage: 18501.5,
      performedAt: "2025-01-02T00:00:00.000Z",
      notes: "Used the owner-supplied filter.",
      parts: ["Oil filter", "4 qt oil"],
      cost: 42.5,
    });
  });

  it.each([
    { performedMileage: -1 },
    { performedMileage: Number.NaN },
    { performedMileage: Number.POSITIVE_INFINITY },
    { performedMileage: "" },
  ])("rejects invalid performed mileage: $performedMileage", (input) => {
    expect(() =>
      validateMaintenanceRecordInput({
        serviceType: "Oil change",
        ...input,
      }),
    ).toThrow(MaintenanceRecordValidationError);
  });

  it("requires the service type and rejects unknown metadata", () => {
    expect(() => validateMaintenanceRecordInput({ performedMileage: 100 })).toThrow(
      "A service type is required",
    );
    expect(() =>
      validateMaintenanceRecordInput({
        serviceType: "Oil change",
        performedMileage: 100,
        unexpected: true,
      }),
    ).toThrow("field 'unexpected' is not allowed");
  });

  it("validates partial updates without making optional fields required", () => {
    expect(
      validateMaintenanceRecordUpdateInput({ notes: "Updated note" }),
    ).toEqual({ notes: "Updated note" });
    expect(() => validateMaintenanceRecordUpdateInput({})).toThrow(
      "At least one maintenance record field must be updated",
    );
  });

  it("rejects performed mileage above the locked current mileage", () => {
    expect(() =>
      validatePerformedMileageAgainstCurrentMileage(18_502, 18_501),
    ).toThrow("cannot exceed the current motorcycle mileage");
    expect(() =>
      validatePerformedMileageAgainstCurrentMileage(18_501, 18_501),
    ).not.toThrow();
  });
});
