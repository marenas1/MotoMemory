import { z } from "zod";

export const MAX_MILEAGE_DECIMAL_PLACES = 2;

const mileageInputSchema = z.union([z.string(), z.number()]);

function hasSupportedPrecision(value: number): boolean {
  const scaled = Math.round(value * 10 ** MAX_MILEAGE_DECIMAL_PLACES);
  return Math.abs(value - scaled / 10 ** MAX_MILEAGE_DECIMAL_PLACES) < 1e-9;
}

export function validateMileageInput(input: unknown): number {
  const parsed = mileageInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Mileage must be a number.");
  }

  const rawValue = parsed.data;
  if (typeof rawValue === "string" && rawValue.trim() === "") {
    throw new Error("Mileage is required.");
  }

  const value = typeof rawValue === "string" ? Number(rawValue) : rawValue;
  if (!Number.isFinite(value)) {
    throw new Error("Mileage must be a number.");
  }

  if (value < 0) {
    throw new Error("Mileage must be zero or greater.");
  }

  if (!hasSupportedPrecision(value)) {
    throw new Error("Mileage may contain at most two decimal places.");
  }

  return value;
}
