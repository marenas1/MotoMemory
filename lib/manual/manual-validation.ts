import { createHash } from "node:crypto";

export const MAX_MANUAL_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_MANUAL_PAGE_COUNT = 100;
export const MANUAL_CONTENT_TYPE = "application/pdf" as const;
export const MANUAL_STORAGE_BUCKET = "manuals";

export interface ManualMetadataInput {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  sha256: string;
  pageCount: number;
}

export interface ValidatedManualMetadata {
  fileName: string;
  contentType: typeof MANUAL_CONTENT_TYPE;
  fileSizeBytes: number;
  sha256: string;
  pageCount: number;
}

export class ManualValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualValidationError";
  }
}

export function hashManualBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateManualPdfBytes(bytes: Uint8Array): void {
  if (bytes.byteLength < 5) {
    throw new ManualValidationError("The manual file is empty or is not a PDF.");
  }

  const header = new TextDecoder().decode(bytes.subarray(0, 1024));
  if (!header.includes("%PDF-")) {
    throw new ManualValidationError(
      "The uploaded file does not contain a valid PDF header.",
    );
  }
}

export function validateManualFileSize(fileSizeBytes: number): void {
  if (
    !Number.isSafeInteger(fileSizeBytes) ||
    fileSizeBytes < 1 ||
    fileSizeBytes > MAX_MANUAL_FILE_SIZE_BYTES
  ) {
    throw new ManualValidationError(
      `Manual files must be between 1 byte and ${MAX_MANUAL_FILE_SIZE_BYTES} bytes.`,
    );
  }
}

export function validateManualSha256(sha256: string): string {
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    throw new ManualValidationError(
      "The manual SHA-256 digest must be a lowercase 64-character hexadecimal value.",
    );
  }

  return sha256;
}

export function validateManualMetadata(
  input: ManualMetadataInput,
): ValidatedManualMetadata {
  const fileName = input.fileName.trim();
  if (!fileName) {
    throw new ManualValidationError("A manual file name is required.");
  }

  if (input.contentType !== MANUAL_CONTENT_TYPE) {
    throw new ManualValidationError("The manual must be a PDF file.");
  }

  validateManualFileSize(input.fileSizeBytes);

  const sha256 = validateManualSha256(input.sha256);

  if (
    !Number.isInteger(input.pageCount) ||
    input.pageCount < 1 ||
    input.pageCount > MAX_MANUAL_PAGE_COUNT
  ) {
    throw new ManualValidationError(
      `Manual PDFs must contain between 1 and ${MAX_MANUAL_PAGE_COUNT} pages.`,
    );
  }

  return {
    fileName,
    contentType: MANUAL_CONTENT_TYPE,
    fileSizeBytes: input.fileSizeBytes,
    sha256,
    pageCount: input.pageCount,
  };
}

export function validateManualStorageKey(storageKey: string): string {
  const normalized = storageKey.trim();
  const parts = normalized.split("/");

  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.endsWith("/") ||
    parts.some((part) => !part || part === "." || part === "..") ||
    !/^[A-Za-z0-9._/-]+$/.test(normalized)
  ) {
    throw new ManualValidationError("The manual storage key is invalid.");
  }

  return normalized;
}

export function buildManualStorageKey(
  motorcycleId: string,
  documentId: string,
): string {
  if (!/^[A-Za-z0-9_-]+$/.test(motorcycleId)) {
    throw new ManualValidationError("The motorcycle storage scope is invalid.");
  }

  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    throw new ManualValidationError("The manual document ID is invalid.");
  }

  return validateManualStorageKey(`manuals/${motorcycleId}/${documentId}.pdf`);
}
