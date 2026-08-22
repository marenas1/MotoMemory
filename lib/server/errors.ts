import "server-only";

export type AppErrorCode =
  | "MOTORCYCLE_NOT_FOUND"
  | "INVALID_MILEAGE"
  | "INVALID_CONFIGURATION"
  | "DATABASE_UNAVAILABLE"
  | "UPDATE_FAILED"
  | "STALE_STATE";

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
