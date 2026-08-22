import { describe, expect, it } from "vitest";

import { validateMileageInput } from "../../lib/domain/mileage";

describe("validateMileageInput", () => {
  it("accepts the seeded mileage and lower corrections", () => {
    expect(validateMileageInput("18501")).toBe(18501);
    expect(validateMileageInput("17000")).toBe(17000);
    expect(validateMileageInput(0)).toBe(0);
  });

  it("accepts up to two decimal places without rounding", () => {
    expect(validateMileageInput("18501.25")).toBe(18501.25);
  });

  it.each(["", "   ", "mileage", -1, "-0.01", Infinity, NaN, "1.234"])(
    "rejects %s",
    (value) => {
      expect(() => validateMileageInput(value)).toThrow();
    },
  );
});
