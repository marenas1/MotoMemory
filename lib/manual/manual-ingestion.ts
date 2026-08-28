import "server-only";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  manualRepository,
  type ManualRepository,
} from "@/lib/data/manual-repository";
import { createPageChunks } from "@/lib/manual/chunking";
import { manualStorage, type ManualObjectStorage } from "@/lib/manual/manual-storage";
import type {
  ManualDocumentRecord,
  ManualPageRecord,
  OcrAdapter,
  PageProvenance,
  PdfReader,
} from "@/lib/manual/manual-types";
import { extractManualMaintenanceFacts } from "@/lib/manual/manual-facts";
import { TesseractCliOcrAdapter } from "@/lib/manual/ocr";
import { buildPageProvenance } from "@/lib/manual/page-provenance";
import { createLocalPdfReader } from "@/lib/manual/pdf-reader";
import { AppError } from "@/lib/server/errors";
import type { DataScope } from "@/lib/server/data-scope";

export interface ManualIngestionDependencies {
  repository: Pick<ManualRepository, "findCurrent" | "beginProcessing">;
}

export interface ManualProcessingDependencies {
  repository: Pick<
    ManualRepository,
    "findById" | "markReady" | "markFailed"
  >;
  process(document: ManualDocumentRecord): Promise<void>;
}

export interface PageIngestionDependencies {
  repository: Pick<ManualRepository, "listPages" | "savePageWithChunks"> &
    Partial<Pick<ManualRepository, "upsertManualMaintenanceFacts">>;
  storage: ManualObjectStorage;
  pdfReader: PdfReader;
  ocr: OcrAdapter;
}

export interface ManualIngestionStart {
  manual: ManualDocumentRecord;
  started: boolean;
}

export class ManualPageProcessingError extends Error {
  readonly failedPages: number[];

  constructor(failedPages: number[]) {
    super(
      `OCR failed for PDF page${failedPages.length === 1 ? "" : "s"} ${failedPages.join(", ")}. Retry processing to retry the incomplete pages.`,
    );
    this.name = "ManualPageProcessingError";
    this.failedPages = failedPages;
  }
}

async function withTemporaryPdf<T>(
  bytes: Uint8Array,
  operation: (pdfPath: string) => Promise<T>,
): Promise<T> {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "motomemory-manual-ingestion-"),
  );
  const pdfPath = path.join(temporaryDirectory, "manual.pdf");

  try {
    await writeFile(pdfPath, bytes);
    return await operation(pdfPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function pageFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim().slice(0, 2_000) || "The page could not be OCR'd.";
}

function isAvailablePage(page: ManualPageRecord): boolean {
  return page.extractionStatus === "available";
}

async function processStoredManual(
  document: ManualDocumentRecord,
  scope: DataScope,
  dependencies: PageIngestionDependencies,
): Promise<void> {
  const storedObject = await dependencies.storage.get(document.storageKey);

  await withTemporaryPdf(storedObject.bytes, async (pdfPath) => {
    const sourcePageCount = await dependencies.pdfReader.getPageCount(pdfPath);
    if (sourcePageCount !== document.pageCount) {
      throw new Error(
        `The stored PDF reports ${sourcePageCount} pages, but the manual metadata reports ${document.pageCount}.`,
      );
    }

    const existingPages = new Map(
      (await dependencies.repository.listPages(scope, document.id)).map((page) => [
        page.pageNumber,
        page,
      ]),
    );
    const failedPages: number[] = [];

    for (let pageNumber = 1; pageNumber <= document.pageCount; pageNumber += 1) {
      const existingPage = existingPages.get(pageNumber);
      if (existingPage && isAvailablePage(existingPage)) {
        continue;
      }

      try {
        const image = await dependencies.pdfReader.renderPage(pdfPath, pageNumber);
        if (image.pageNumber !== pageNumber) {
          throw new Error(
            `The PDF renderer returned page ${image.pageNumber} while processing page ${pageNumber}.`,
          );
        }

        const ocrResult = await dependencies.ocr.recognize(image, {
          pageNumber,
        });
        if (ocrResult.pageNumber !== pageNumber) {
          throw new Error(
            `The OCR adapter returned page ${ocrResult.pageNumber} while processing page ${pageNumber}.`,
          );
        }

        const provenance: PageProvenance = buildPageProvenance(
          pageNumber,
          ocrResult.text,
        );
        const hasSearchableText = Boolean(provenance.extractedText.trim());

        await dependencies.repository.savePageWithChunks(
          scope,
          document.id,
          {
            pageNumber,
            printedPageLabel: provenance.printedPageLabel,
            extractedText: provenance.extractedText,
            extractionStatus: "available",
            errorMessage: hasSearchableText
              ? null
              : "No searchable text detected on this page.",
            ocrEngine: ocrResult.engine,
          },
          hasSearchableText
            ? createPageChunks(provenance, `${ocrResult.engine}:v1`)
            : [],
        );
      } catch (error) {
        failedPages.push(pageNumber);
        await dependencies.repository.savePageWithChunks(
          scope,
          document.id,
          {
            pageNumber,
            printedPageLabel: null,
            extractedText: null,
            extractionStatus: "failed",
            errorMessage: pageFailureMessage(error),
            ocrEngine: null,
          },
          [],
        );
      }
    }

    if (failedPages.length === 0 && dependencies.repository.upsertManualMaintenanceFacts) {
      const pages = await dependencies.repository.listPages(scope, document.id);
      const facts = extractManualMaintenanceFacts(
        document.id,
        document.motorcycleId,
        pages,
      );
      await dependencies.repository.upsertManualMaintenanceFacts(
        scope,
        document.id,
        facts,
      );
    }

    if (failedPages.length > 0) {
      throw new ManualPageProcessingError(failedPages);
    }
  });
}

export async function processManualPages(
  document: ManualDocumentRecord,
  scope: DataScope,
  dependencies: PageIngestionDependencies,
): Promise<void> {
  await processStoredManual(document, scope, dependencies);
}

export async function startManualIngestion(
  scope: DataScope,
  dependencies: ManualIngestionDependencies,
): Promise<ManualIngestionStart> {
  const currentDocument = await dependencies.repository.findCurrent(scope);
  if (!currentDocument) {
    throw new AppError(
      "MANUAL_NOT_FOUND",
      "No manual is uploaded for the GS750.",
      404,
    );
  }

  if (currentDocument.status === "processing") {
    return { manual: currentDocument, started: false };
  }

  const processingDocument = await dependencies.repository.beginProcessing(
    scope,
    currentDocument.id,
  );
  if (!processingDocument) {
    throw new AppError(
      "MANUAL_NOT_FOUND",
      "The manual disappeared before processing could start.",
      404,
    );
  }

  return {
    manual: processingDocument,
    started: processingDocument.status === "processing",
  };
}

export function startConfiguredManualIngestion(
  scope: DataScope,
): Promise<ManualIngestionStart> {
  return startManualIngestion(scope, {
    repository: manualRepository,
  });
}

export async function runManualIngestion(
  scope: DataScope,
  documentId: string,
  dependencies: ManualProcessingDependencies,
): Promise<ManualDocumentRecord> {
  const document = await dependencies.repository.findById(scope, documentId);
  if (!document) {
    throw new AppError(
      "MANUAL_NOT_FOUND",
      "The manual was not found for processing.",
      404,
    );
  }

  if (document.status === "ready") {
    return document;
  }

  if (document.status !== "processing") {
    throw new AppError(
      "MANUAL_PROCESSING",
      "The manual must be in processing state before completion can be recorded.",
      409,
    );
  }

  try {
    await dependencies.process(document);
    const readyDocument = await dependencies.repository.markReady(scope, documentId);
    if (!readyDocument) {
      throw new AppError(
        "MANUAL_PROCESSING",
        "The manual disappeared before readiness could be recorded.",
      );
    }
    return readyDocument;
  } catch (error) {
    const failureMessage =
      error instanceof Error ? error.message : "Manual processing failed.";
    const failedDocument = await dependencies.repository.markFailed(
      scope,
      documentId,
      failureMessage,
    );
    if (!failedDocument) {
      throw new AppError(
        "MANUAL_PROCESSING",
        "Manual processing failed and its failure state could not be recorded.",
      );
    }
    return failedDocument;
  }
}

const defaultPageIngestionDependencies: PageIngestionDependencies = {
  repository: manualRepository,
  storage: manualStorage,
  pdfReader: createLocalPdfReader(),
  ocr: new TesseractCliOcrAdapter(),
};

const configuredJobs = new Map<string, Promise<ManualDocumentRecord>>();

export function runConfiguredManualIngestion(
  scope: DataScope,
  documentId: string,
): Promise<ManualDocumentRecord> {
  return runManualIngestion(scope, documentId, {
    repository: manualRepository,
      process: (document) =>
        processManualPages(document, scope, defaultPageIngestionDependencies),
  });
}

/**
 * Keeps one in-process worker per manual. The database page ledger remains
 * the source of truth, so a later request can resume the same manual after a
 * process restart or a failed page attempt.
 */
export function enqueueConfiguredManualIngestion(
  scope: DataScope,
  documentId: string,
): Promise<ManualDocumentRecord> {
  const existingJob = configuredJobs.get(documentId);
  if (existingJob) {
    return existingJob;
  }

  const job = runConfiguredManualIngestion(scope, documentId).finally(() => {
    configuredJobs.delete(documentId);
  });
  configuredJobs.set(documentId, job);
  return job;
}
