import "server-only";

import type { Pool, PoolClient } from "pg";

import { getDatabasePool } from "@/lib/data/database";
import type { DataScope } from "@/lib/server/data-scope";
import { AppError } from "@/lib/server/errors";

export interface OwnerSaveResult<T> {
  result: T;
  changed: boolean;
}

export type OwnerSaveMutation<T> = (
  client: PoolClient,
) => Promise<OwnerSaveResult<T>>;

export interface OwnerSaveOptions {
  pool?: Pool;
}

async function lockSaveBoundary(
  client: PoolClient,
  scope: DataScope,
): Promise<void> {
  const motorcycleResult = await client.query<{ current_mileage: string | number }>(
    `select current_mileage
       from public.motorcycle_state
      where id = $1
      for update`,
    [scope.motorcycleId],
  );

  if (!motorcycleResult.rows[0]) {
    throw new AppError(
      "MOTORCYCLE_NOT_FOUND",
      "The mapped motorcycle state was not found.",
      404,
    );
  }
}

/**
 * Runs one owner mutation against the live source tables. The motorcycle row
 * is locked so mileage-dependent writes retain their existing transaction
 * boundary; no publication, snapshot, or showcase row is involved.
 */
export async function executeOwnerSave<T>(
  scope: DataScope,
  mutation: OwnerSaveMutation<T>,
  options: OwnerSaveOptions = {},
): Promise<T> {
  const pool = options.pool ?? getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    await lockSaveBoundary(client, scope);
    const mutationResult = await mutation(client);
    await client.query("commit");
    return mutationResult.result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const ownerSaveCoordinator = {
  execute: executeOwnerSave,
};
