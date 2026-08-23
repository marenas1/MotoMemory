import "server-only";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  manualRepository,
  type ManualRepository,
} from "@/lib/data/manual-repository";
import { MOTORCYCLE_ID } from "@/lib/data/motorcycle-repository";
import type { ManualDocumentRecord, PdfReader } from "@/lib/manual/manual-types";
import { manualStorage, type ManualObjectStorage } from "@/lib/manual/manual-storage";
import {
  hashManualBytes,
  MANUAL_CONTENT_TYPE,
  validateManualMetadata,
  validateManualFileSize,
  validateManualPdfBytes,
} from "@/lib/manual/manual-validation";
import { persistManualDocument } from "@/lib/manual/manual-persistence";
import { createLocalPdfReader } from "@/lib/manual/pdf-reader";
import { ManualValidationError } from "@/lib/manual/manual-validation";
import { AppError } from "@/lib/server/errors";

export interface UploadManualInput {
  motorcycleId: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface ManualUploadDependencies {
  repository: Pick<
    ManualRepository,
    "findBySha256" | "findCurrent" | "createDocument"
  >;
  storage: ManualObjectStorage;
  pdfReader: PdfReader;
}

async function withTemporaryPdf<T>(
  bytes: Uint8Array,
  operation: (pdfPath: string) => Promise<T>,
): Promise<T> {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "motomemory-manual-upload-"),
  );
  const pdfPath = path.join(temporaryDirectory, "manual.pdf");

  try {
    await writeFile(pdfPath, bytes);
    return await operation(pdfPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function uploadManualDocument(
  input: UploadManualInput,
  dependencies: ManualUploadDependencies,
): Promise<ManualDocumentRecord> {
  if (input.contentType !== MANUAL_CONTENT_TYPE) {
    throw new ManualValidationError(
      "The manual must be uploaded with application/pdf content type.",
    );
  }

  validateManualFileSize(input.bytes.byteLength);
  validateManualPdfBytes(input.bytes);

  const sha256 = hashManualBytes(input.bytes);
  const identicalDocument = await dependencies.repository.findBySha256(
    input.motorcycleId,
    sha256,
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

  let pageCount: number;
  try {
    pageCount = await withTemporaryPdf(input.bytes, (pdfPath) =>
      dependencies.pdfReader.getPageCount(pdfPath),
    );
  } catch (error) {
    throw new ManualValidationError(
      `The uploaded PDF could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const metadata = validateManualMetadata({
    fileName: input.fileName,
    contentType: input.contentType,
    fileSizeBytes: input.bytes.byteLength,
    sha256,
    pageCount,
  });

  return persistManualDocument(
    {
      motorcycleId: input.motorcycleId,
      fileName: metadata.fileName,
      contentType: metadata.contentType,
      bytes: input.bytes,
      pageCount: metadata.pageCount,
    },
    dependencies,
  );
}

export const defaultManualUploadDependencies: ManualUploadDependencies = {
  repository: manualRepository,
  storage: manualStorage,
  pdfReader: createLocalPdfReader(),
};

export function uploadConfiguredManual(
  input: Omit<UploadManualInput, "motorcycleId">,
): Promise<ManualDocumentRecord> {
  return uploadManualDocument(
    { ...input, motorcycleId: MOTORCYCLE_ID },
    defaultManualUploadDependencies,
  );
}
