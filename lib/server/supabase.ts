import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/server/errors";

export function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_PROJECT_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      "SUPABASE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY are required for storage operations.",
      503,
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
