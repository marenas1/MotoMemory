import "server-only";

export type AppErrorCode =
  | "READ_ONLY_MODE"
  | "MOTORCYCLE_NOT_FOUND"
  | "INVALID_MILEAGE"
  | "INVALID_MAINTENANCE_RECORD"
  | "MAINTENANCE_RECORD_NOT_FOUND"
  | "MAINTENANCE_DEFINITION_NOT_FOUND"
  | "INVALID_CONFIGURATION"
  | "INVALID_REQUEST"
  | "REQUEST_TOO_LARGE"
  | "CSRF_FORBIDDEN"
  | "RATE_LIMITED"
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
  readonly retryAfterSeconds: number | null;

  constructor(
    code: AppErrorCode,
    message: string,
    status = 500,
    options: { retryAfterSeconds?: number | null } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
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
