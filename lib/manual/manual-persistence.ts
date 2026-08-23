import "server-only";

import { randomUUID } from "node:crypto";

import type {
  ManualDocumentRecord,
} from "@/lib/manual/manual-types";
import {
  buildManualStorageKey,
  hashManualBytes,
  validateManualMetadata,
} from "@/lib/manual/manual-validation";
import type {
  CreateManualDocumentInput,
  ManualRepository,
} from "@/lib/data/manual-repository";
import type { ManualObjectStorage } from "@/lib/manual/manual-storage";
import { AppError } from "@/lib/server/errors";

export interface PersistManualDocumentInput {
  motorcycleId: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  pageCount: number;
}

export class ManualPersistenceError extends Error {
  readonly causeError: unknown;
  readonly cleanupError: unknown;

  constructor(message: string, causeError: unknown, cleanupError: unknown = null) {
    super(message);
    this.name = "ManualPersistenceError";
    this.causeError = causeError;
    this.cleanupError = cleanupError;
  }
}

export interface ManualPersistenceDependencies {
  storage: ManualObjectStorage;
  repository: Pick<
    ManualRepository,
    "findBySha256" | "findCurrent" | "createDocument"
  >;
}

async function removeStoredObject(
  storage: ManualObjectStorage,
  storageKey: string,
  causeError: unknown,
  message: string,
): Promise<never> {
  try {
    await storage.remove(storageKey);
  } catch (cleanupError) {
    throw new ManualPersistenceError(message, causeError, cleanupError);
  }

  throw causeError;
}

export async function persistManualDocument(
  input: PersistManualDocumentInput,
  dependencies: ManualPersistenceDependencies,
): Promise<ManualDocumentRecord> {
  const documentId = randomUUID();
  const metadata = validateManualMetadata({
    fileName: input.fileName,
    contentType: input.contentType,
    fileSizeBytes: input.bytes.byteLength,
    sha256: hashManualBytes(input.bytes),
    pageCount: input.pageCount,
  });
  const storageKey = buildManualStorageKey(input.motorcycleId, documentId);

  const identicalDocument = await dependencies.repository.findBySha256(
    input.motorcycleId,
    metadata.sha256,
  );
  if (identicalDocument) {
    throw new AppError(
      "MANUAL_DUPLICATE",
      "An identical manual is already uploaded for the GS750.",
      409,
    );
  }

  const currentDocument = await dependencies.repository.findCurrent(
    input.motorcycleId,
  );
  if (currentDocument) {
    throw new AppError(
      "MANUAL_ALREADY_EXISTS",
      "A manual is already uploaded for the GS750.",
      409,
    );
  }

  try {
    await dependencies.storage.put(storageKey, input.bytes, metadata.contentType);
  } catch (error) {
    return removeStoredObject(
      dependencies.storage,
      storageKey,
      error,
      "The manual upload failed and its stored object could not be cleaned up.",
    );
  }

  const repositoryInput: CreateManualDocumentInput = {
    id: documentId,
    motorcycleId: input.motorcycleId,
    storageKey,
    ...metadata,
  };

  try {
    return await dependencies.repository.createDocument(repositoryInput);
  } catch (error) {
    return removeStoredObject(
      dependencies.storage,
      storageKey,
      error,
      "The manual metadata write failed and its stored object could not be cleaned up.",
    );
  }
}
