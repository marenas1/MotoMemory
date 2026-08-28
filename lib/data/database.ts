import "server-only";

import { Pool } from "pg";

import { AppError } from "@/lib/server/errors";

let pool: Pool | undefined;

export function getDatabasePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      "DATABASE_URL is not configured for the local app.",
      503,
    );
  }

  pool ??= new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

  return pool;
}
