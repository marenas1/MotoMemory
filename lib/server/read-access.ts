import "server-only";

import type { DataScope } from "@/lib/server/data-scope";
import { OWNER_SCOPE } from "@/lib/server/owner-scope";
import { resolveRuntimeMode } from "@/lib/server/runtime-mode";

export interface ReadAccess {
  scope: DataScope;
  isOwner: boolean;
}

/** Guests use this scope only inside the server-side repository layer. */
export function getPublicReadScope(): DataScope {
  return { motorcycleId: "gs750" };
}

/** Resolve live read access from server configuration, never a browser session. */
export async function getReadableScope(): Promise<ReadAccess> {
  const isOwner = resolveRuntimeMode() === "owner";
  return {
    scope: isOwner ? OWNER_SCOPE : getPublicReadScope(),
    isOwner,
  };
}
