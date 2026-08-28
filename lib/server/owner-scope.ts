import "server-only";

import type { DataScope } from "@/lib/server/data-scope";

/** The one motorcycle scope available to the local owner process. */
export const OWNER_SCOPE: DataScope = Object.freeze({
  motorcycleId: "gs750",
});
