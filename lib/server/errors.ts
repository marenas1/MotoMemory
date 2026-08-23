import "server-only";

export type AppErrorCode =
  | "MOTORCYCLE_NOT_FOUND"
  | "INVALID_MILEAGE"
  | "INVALID_CONFIGURATION"
  | "DATABASE_UNAVAILABLE"
  | "UPDATE_FAILED"
  | "STALE_STATE"
  | "INVALID_MANUAL"
  | "MANUAL_NOT_FOUND"
  | "MANUAL_DUPLICATE"
  | "MANUAL_ALREADY_EXISTS"
  | "MANUAL_PROCESSING"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_CLEANUP_FAILED";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;

  constructor(code: AppErrorCode, message: string, status = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError(
    "DATABASE_UNAVAILABLE",
    "The motorcycle database is unavailable right now.",
  );
}
