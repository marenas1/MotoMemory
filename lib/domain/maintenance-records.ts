import type {
  CreateMaintenanceRecordInput,
  UpdateMaintenanceRecordInput,
} from "@/lib/domain/types";

const MAX_SERVICE_TYPE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2_000;
const MAX_PART_LENGTH = 200;
const MAX_PARTS = 50;

const ALLOWED_RECORD_FIELDS = new Set([
  "definitionId",
  "serviceType",
  "performedMileage",
  "performedAt",
  "notes",
  "parts",
  "cost",
]);

export class MaintenanceRecordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaintenanceRecordValidationError";
  }
}

function assertRecordObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new MaintenanceRecordValidationError(
      "A maintenance record object is required.",
    );
  }

  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_RECORD_FIELDS.has(key)) {
      throw new MaintenanceRecordValidationError(
        `The maintenance record field '${key}' is not allowed.`,
      );
    }
  }

  return record;
}

function validateServiceType(input: unknown): string {
  if (typeof input !== "string") {
    throw new MaintenanceRecordValidationError(
      "A service type is required.",
    );
  }

  const serviceType = input.trim();
  if (!serviceType) {
    throw new MaintenanceRecordValidationError(
      "A service type is required.",
    );
  }

  if (serviceType.length > MAX_SERVICE_TYPE_LENGTH) {
    throw new MaintenanceRecordValidationError(
      `A service type must be ${MAX_SERVICE_TYPE_LENGTH} characters or fewer.`,
    );
  }

  return serviceType;
}

function validateFiniteNonNegativeNumber(
  input: unknown,
  fieldName: string,
): number {
  if (
    (typeof input !== "number" && typeof input !== "string") ||
    (typeof input === "string" && input.trim() === "")
  ) {
    throw new MaintenanceRecordValidationError(
      `${fieldName} must be a finite number.`,
    );
  }

  const value = typeof input === "string" ? Number(input) : input;
  if (!Number.isFinite(value)) {
    throw new MaintenanceRecordValidationError(
      `${fieldName} must be a finite number.`,
    );
  }

  if (value < 0) {
    throw new MaintenanceRecordValidationError(
      `${fieldName} must be zero or greater.`,
    );
  }

  return value;
}

function validateDefinitionId(input: unknown): string | null {
  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input !== "string" || !input.trim()) {
    throw new MaintenanceRecordValidationError(
      "The maintenance definition reference must be a non-empty string.",
    );
  }

  return input.trim();
}

function validatePerformedAt(input: unknown): string | null {
  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input !== "string" || !input.trim()) {
    throw new MaintenanceRecordValidationError(
      "The service date must be a valid date string.",
    );
  }

  const parsed = new Date(input);
  if (!Number.isFinite(parsed.getTime())) {
    throw new MaintenanceRecordValidationError(
      "The service date must be a valid date string.",
    );
  }

  return parsed.toISOString();
}

function validateNotes(input: unknown): string | null {
  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input !== "string") {
    throw new MaintenanceRecordValidationError(
      "Notes must be text when provided.",
    );
  }

  const notes = input.trim();
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new MaintenanceRecordValidationError(
      `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`,
    );
  }

  return notes || null;
}

function validateParts(input: unknown): string[] | null {
  if (input === undefined || input === null) {
    return null;
  }

  if (!Array.isArray(input) || input.length > MAX_PARTS) {
    throw new MaintenanceRecordValidationError(
      `Parts must contain at most ${MAX_PARTS} text entries.`,
    );
  }

  const parts = input.map((part) => {
    if (typeof part !== "string" || !part.trim()) {
      throw new MaintenanceRecordValidationError(
        "Each part must be non-empty text.",
      );
    }

    const normalizedPart = part.trim();
    if (normalizedPart.length > MAX_PART_LENGTH) {
      throw new MaintenanceRecordValidationError(
        `Each part must be ${MAX_PART_LENGTH} characters or fewer.`,
      );
    }

    return normalizedPart;
  });

  return parts.length > 0 ? parts : null;
}

function validateCost(input: unknown): number | null {
  if (input === undefined || input === null) {
    return null;
  }

  return validateFiniteNonNegativeNumber(input, "Cost");
}

export function validateMaintenanceRecordInput(
  input: unknown,
): CreateMaintenanceRecordInput {
  const record = assertRecordObject(input);

  if (!("serviceType" in record)) {
    throw new MaintenanceRecordValidationError(
      "A service type is required.",
    );
  }
  if (!("performedMileage" in record)) {
    throw new MaintenanceRecordValidationError(
      "Performed mileage is required.",
    );
  }

  return {
    definitionId: validateDefinitionId(record.definitionId),
    serviceType: validateServiceType(record.serviceType),
    performedMileage: validateFiniteNonNegativeNumber(
      record.performedMileage,
      "Performed mileage",
    ),
    performedAt: validatePerformedAt(record.performedAt),
    notes: validateNotes(record.notes),
    parts: validateParts(record.parts),
    cost: validateCost(record.cost),
  };
}

export function validateMaintenanceRecordUpdateInput(
  input: unknown,
): UpdateMaintenanceRecordInput {
  const record = assertRecordObject(input);
  if (Object.keys(record).length === 0) {
    throw new MaintenanceRecordValidationError(
      "At least one maintenance record field must be updated.",
    );
  }

  return {
    ...(Object.hasOwn(record, "definitionId")
      ? { definitionId: validateDefinitionId(record.definitionId) }
      : {}),
    ...(Object.hasOwn(record, "serviceType")
      ? { serviceType: validateServiceType(record.serviceType) }
      : {}),
    ...(Object.hasOwn(record, "performedMileage")
      ? {
          performedMileage: validateFiniteNonNegativeNumber(
            record.performedMileage,
            "Performed mileage",
          ),
        }
      : {}),
    ...(Object.hasOwn(record, "performedAt")
      ? { performedAt: validatePerformedAt(record.performedAt) }
      : {}),
    ...(Object.hasOwn(record, "notes")
      ? { notes: validateNotes(record.notes) }
      : {}),
    ...(Object.hasOwn(record, "parts")
      ? { parts: validateParts(record.parts) }
      : {}),
    ...(Object.hasOwn(record, "cost")
      ? { cost: validateCost(record.cost) }
      : {}),
  };
}

export function validatePerformedMileageAgainstCurrentMileage(
  performedMileage: number,
  currentMileage: number,
): void {
  if (!Number.isFinite(currentMileage) || currentMileage < 0) {
    throw new MaintenanceRecordValidationError(
      "The current motorcycle mileage is invalid.",
    );
  }

  if (performedMileage > currentMileage) {
    throw new MaintenanceRecordValidationError(
      "Performed mileage cannot exceed the current motorcycle mileage.",
    );
  }
}
