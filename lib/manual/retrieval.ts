import "server-only";

import {
  manualRepository,
  type ManualRepository,
} from "@/lib/data/manual-repository";
import type { ManualChunkRecord } from "@/lib/manual/manual-types";
import { AppError } from "@/lib/server/errors";
import type { DataScope } from "@/lib/server/data-scope";

export const DEFAULT_MANUAL_SEARCH_LIMIT = 8;
export const MAX_MANUAL_SEARCH_LIMIT = 20;
export const MAX_MANUAL_QUERY_CHARACTERS = 500;

export interface ManualSearchDependencies {
  repository: Pick<ManualRepository, "searchChunks">;
}

function validateSearchQuery(query: string): string {
  const normalized = query.trim();
  if (!normalized) {
    throw new AppError(
      "INVALID_MANUAL",
      "A non-empty manual search query is required.",
      400,
    );
  }

  if (normalized.length > MAX_MANUAL_QUERY_CHARACTERS) {
    throw new AppError(
      "INVALID_MANUAL",
      `Manual search queries must be ${MAX_MANUAL_QUERY_CHARACTERS} characters or fewer.`,
      400,
    );
  }

  return normalized;
}

function validateSearchLimit(limit: number): number {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_MANUAL_SEARCH_LIMIT
  ) {
    throw new AppError(
      "INVALID_MANUAL",
      `Manual search limits must be between 1 and ${MAX_MANUAL_SEARCH_LIMIT}.`,
      400,
    );
  }
  return limit;
}

export async function searchManualChunks(
  scope: DataScope,
  manualId: string,
  query: string,
  dependencies: ManualSearchDependencies = { repository: manualRepository },
  limit = DEFAULT_MANUAL_SEARCH_LIMIT,
): Promise<ManualChunkRecord[]> {
  return dependencies.repository.searchChunks(
    scope,
    manualId,
    validateSearchQuery(query),
    validateSearchLimit(limit),
  );
}
