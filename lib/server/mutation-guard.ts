import "server-only";

import { AppError } from "@/lib/server/errors";
import { resolveRuntimeMode, type RuntimeMode } from "@/lib/server/runtime-mode";

export const READ_ONLY_MODE_MESSAGE =
  "This MotoMemory deployment is read-only. Run the local owner application to make changes.";

export function readOnlyModeError(): AppError {
  return new AppError("READ_ONLY_MODE", READ_ONLY_MODE_MESSAGE, 403);
}

/** Require the process to be explicitly configured for local owner mode. */
export function requireOwnerMode(): RuntimeMode {
  const mode = resolveRuntimeMode();
  if (mode !== "owner") {
    throw readOnlyModeError();
  }
  return mode;
}

/** Assertion-style alias for mutation handlers. */
export function assertMutationMode(): void {
  requireOwnerMode();
}
