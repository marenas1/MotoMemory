import { ManualPersistenceError } from "@/lib/manual/manual-persistence";
import { ManualStorageError } from "@/lib/manual/manual-storage";
import { ManualValidationError } from "@/lib/manual/manual-validation";
import { AppError } from "@/lib/server/errors";

export function manualApiError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ManualValidationError) {
    return new AppError("INVALID_MANUAL", error.message, 400);
  }

  if (error instanceof ManualStorageError) {
    return new AppError("STORAGE_UNAVAILABLE", error.message, error.status);
  }

  if (error instanceof ManualPersistenceError) {
    return new AppError("STORAGE_CLEANUP_FAILED", error.message, 500);
  }

  return new AppError(
    "DATABASE_UNAVAILABLE",
    "The manual service is unavailable right now.",
    503,
  );
}
