import "server-only";

export type RuntimeMode = "owner" | "readonly";

let productionOwnerWarningEmitted = false;

function warnAboutProductionOwnerMode(): void {
  if (productionOwnerWarningEmitted) return;
  productionOwnerWarningEmitted = true;
  console.warn(
    "[MotoMemory] MOTOMEMORY_RUNTIME_MODE=owner is ignored in production; using readonly.",
  );
}

/**
 * Resolve the process-wide write policy from server configuration only.
 *
 * This function deliberately accepts no request or client input. An owner
 * process is therefore an explicit local configuration choice, never a mode
 * that a browser can request.
 */
export function resolveRuntimeMode(): RuntimeMode {
  if (process.env.NODE_ENV === "production") {
    if (process.env.MOTOMEMORY_RUNTIME_MODE === "owner") {
      warnAboutProductionOwnerMode();
    }
    return "readonly";
  }

  return process.env.MOTOMEMORY_RUNTIME_MODE === "owner" ? "owner" : "readonly";
}

export function isOwnerRuntimeMode(): boolean {
  return resolveRuntimeMode() === "owner";
}
