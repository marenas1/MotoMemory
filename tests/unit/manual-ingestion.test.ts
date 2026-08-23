import { describe, expect, it } from "vitest";

import {
  processManualPages,
  runManualIngestion,
  startManualIngestion,
} from "@/lib/manual/manual-ingestion";
import type {
  ManualChunkInput,
  ManualDocumentRecord,
  ManualMaintenanceFactInput,
  ManualPageRecord,
  ManualPageUpsertInput,
  OcrAdapter,
  PdfPageImage,
  PdfReader,
} from "@/lib/manual/manual-types";

const manual: ManualDocumentRecord = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  motorcycleId: "gs750",
  fileName: "manual.pdf",
  contentType: "application/pdf",
  storageKey: "manuals/gs750/123e4567-e89b-12d3-a456-426614174000.pdf",
  fileSizeBytes: 3_700_000,
  sha256: "a".repeat(64),
  pageCount: 67,
  status: "uploaded",
  extractionMethod: "ocr",
  errorMessage: null,
  uploadedAt: new Date(0).toISOString(),
  processedAt: null,
};

function createPage(pageNumber: number, status: "available" | "failed" = "available"): ManualPageRecord {
  return {
    id: `page-${pageNumber}`,
    manualId: manual.id,
    pageNumber,
    printedPageLabel: status === "available" ? String(pageNumber + 10) : null,
    extractedText: status === "available" ? `Existing OCR for page ${pageNumber}` : null,
    extractionStatus: status,
    errorMessage: status === "failed" ? "OCR failed previously" : null,
    ocrEngine: status === "available" ? "fake-ocr" : null,
    processedAt: new Date(0).toISOString(),
  };
}

function createPageDependencies(options: {
  pageCount: number;
  existingPages?: ManualPageRecord[];
  failingPages?: number[];
  ocrTextByPage?: Record<number, string>;
}): {
  dependencies: Parameters<typeof processManualPages>[1];
  pages: ManualPageRecord[];
  saved: Array<{ page: ManualPageUpsertInput; chunks: ManualChunkInput[] }>;
  upsertedFacts: ManualMaintenanceFactInput[][];
  renderedPages: number[];
} {
  const pages = [...(options.existingPages ?? [])];
  const saved: Array<{ page: ManualPageUpsertInput; chunks: ManualChunkInput[] }> = [];
  const upsertedFacts: ManualMaintenanceFactInput[][] = [];
  const renderedPages: number[] = [];
  const failingPages = new Set(options.failingPages ?? []);
  const reader: PdfReader = {
    getPageCount: async () => options.pageCount,
    renderPage: async (_pdfPath, pageNumber): Promise<PdfPageImage> => {
      renderedPages.push(pageNumber);
      return {
        pageNumber,
        mimeType: "image/png",
        bytes: new Uint8Array([pageNumber]),
      };
    },
  };
  const ocr: OcrAdapter = {
    name: "fake-ocr",
    recognize: async (image) => {
      if (failingPages.has(image.pageNumber)) {
        throw new Error(`OCR unavailable for page ${image.pageNumber}`);
      }
      return {
        pageNumber: image.pageNumber,
        text: options.ocrTextByPage?.[image.pageNumber] ?? `SERVICE MANUAL\nPage ${image.pageNumber + 10}\nMaintenance instructions for PDF page ${image.pageNumber}.`,
        engine: "fake-ocr",
      };
    },
  };

  return {
    dependencies: {
      repository: {
        listPages: async () => [...pages],
        savePageWithChunks: async (_manualId, page, chunks) => {
          saved.push({ page, chunks });
          const index = pages.findIndex((existing) => existing.pageNumber === page.pageNumber);
          const record: ManualPageRecord = {
            id: `page-${page.pageNumber}`,
            manualId: manual.id,
            pageNumber: page.pageNumber,
            printedPageLabel: page.printedPageLabel,
            extractedText: page.extractedText,
            extractionStatus: page.extractionStatus,
            errorMessage: page.errorMessage,
            ocrEngine: page.ocrEngine,
            processedAt: new Date().toISOString(),
          };
          if (index >= 0) {
            pages[index] = record;
          } else {
            pages.push(record);
          }
          return record;
        },
        upsertManualMaintenanceFacts: async (_motorcycleId, _manualId, facts) => {
          upsertedFacts.push(facts);
          return [];
        },
      },
      storage: {
        put: async () => undefined,
        get: async () => ({
          bytes: new Uint8Array([37, 80, 68, 70]),
          contentType: "application/pdf",
        }),
        remove: async () => undefined,
      },
      pdfReader: reader,
      ocr,
    },
    pages,
    saved,
    upsertedFacts,
    renderedPages,
  };
}

describe("manual ingestion lifecycle boundary", () => {
  it.each(["uploaded", "failed"] as const)(
    "moves %s to processing and reports that work started",
    async (status) => {
      const beginProcessing = async () => ({ ...manual, status: "processing" as const });

      const result = await startManualIngestion("gs750", {
        repository: {
          findCurrent: async () => ({ ...manual, status }),
          beginProcessing,
        },
      });

      expect(result).toMatchObject({ started: true, manual: { status: "processing" } });
    },
  );

  it("does not restart an already processing manual", async () => {
    let beginCalls = 0;

    const result = await startManualIngestion("gs750", {
      repository: {
        findCurrent: async () => ({ ...manual, status: "processing" }),
        beginProcessing: async () => {
          beginCalls += 1;
          return { ...manual, status: "processing" };
        },
      },
    });

    expect(result).toMatchObject({ started: false, manual: { status: "processing" } });
    expect(beginCalls).toBe(0);
  });

  it("allows a ready manual to be reprocessed", async () => {
    let beginCalls = 0;

    const result = await startManualIngestion("gs750", {
      repository: {
        findCurrent: async () => ({ ...manual, status: "ready", processedAt: new Date().toISOString() }),
        beginProcessing: async () => {
          beginCalls += 1;
          return { ...manual, status: "processing" };
        },
      },
    });

    expect(result).toMatchObject({ started: true, manual: { status: "processing" } });
    expect(beginCalls).toBe(1);
  });

  it("reports a missing manual instead of creating processing state", async () => {
    await expect(
      startManualIngestion("gs750", {
        repository: {
          findCurrent: async () => null,
          beginProcessing: async () => null,
        },
      }),
      ).rejects.toMatchObject({ code: "MANUAL_NOT_FOUND", status: 404 });
  });

  it("records a failed processor attempt without touching the source object", async () => {
    const transitions: string[] = [];
    const failedManual = { ...manual, status: "failed" as const, errorMessage: "OCR unavailable" };

    const result = await runManualIngestion("manual-1", {
      repository: {
        findById: async () => ({ ...manual, id: "manual-1", status: "processing" }),
        markReady: async () => {
          transitions.push("ready");
          return { ...manual, status: "ready" };
        },
        markFailed: async (_documentId, message) => {
          transitions.push(`failed:${message}`);
          return failedManual;
        },
      },
      process: async () => {
        throw new Error("OCR unavailable");
      },
    });

    expect(result).toEqual(failedManual);
    expect(transitions).toEqual(["failed:OCR unavailable"]);
  });

  it("marks a processor success ready only after the processor resolves", async () => {
    const transitions: string[] = [];

    const result = await runManualIngestion("manual-1", {
      repository: {
        findById: async () => ({ ...manual, id: "manual-1", status: "processing" }),
        markReady: async () => {
          transitions.push("ready");
          return { ...manual, status: "ready", processedAt: new Date().toISOString() };
        },
        markFailed: async () => {
          transitions.push("failed");
          return { ...manual, status: "failed" };
        },
      },
      process: async () => {
        transitions.push("processed");
      },
    });

    expect(result.status).toBe("ready");
    expect(transitions).toEqual(["processed", "ready"]);
  });
});

describe("page-by-page OCR ingestion", () => {
  it("accounts for every page and persists page-linked searchable chunks", async () => {
    const fixture = createPageDependencies({ pageCount: 3 });

    await processManualPages({ ...manual, pageCount: 3, status: "processing" }, fixture.dependencies);

    expect(fixture.renderedPages).toEqual([1, 2, 3]);
    expect(fixture.pages).toHaveLength(3);
    expect(fixture.pages.every((page) => page.extractionStatus === "available")).toBe(true);
    expect(fixture.saved).toHaveLength(3);
    expect(fixture.saved.every(({ chunks }) => chunks.length === 1)).toBe(true);
    expect(fixture.saved.map(({ chunks }) => chunks[0]?.pageStart)).toEqual([1, 2, 3]);
  });

  it("upserts trusted maintenance facts only after all OCR pages succeed", async () => {
    const fixture = createPageDependencies({
      pageCount: 1,
      ocrTextByPage: { 1: "Maintenance schedule\nOil change every 2,000 miles" },
    });

    await processManualPages({ ...manual, pageCount: 1, status: "processing" }, fixture.dependencies);

    expect(fixture.upsertedFacts).toHaveLength(1);
    expect(fixture.upsertedFacts[0]).toEqual([
      expect.objectContaining({
        name: "Oil change",
        intervalValue: 2000,
        intervalUnit: "mi",
        sourcePageStart: 1,
        sourceManualId: manual.id,
      }),
    ]);
  });

  it("treats an empty OCR page as accounted but non-searchable", async () => {
    const fixture = createPageDependencies({
      pageCount: 2,
      ocrTextByPage: {
        1: "",
        2: "Maintenance schedule\nOil change every 2,000 miles",
      },
    });

    await processManualPages({ ...manual, pageCount: 2, status: "processing" }, fixture.dependencies);

    expect(fixture.pages).toHaveLength(2);
    expect(fixture.pages[0]).toMatchObject({
      pageNumber: 1,
      extractionStatus: "available",
      extractedText: "",
      errorMessage: "No searchable text detected on this page.",
    });
    expect(fixture.pages[1]?.extractionStatus).toBe("available");
    expect(fixture.upsertedFacts).toHaveLength(1);
  });

  it("records a page OCR failure, continues processing, and leaves the source available", async () => {
    const fixture = createPageDependencies({ pageCount: 3, failingPages: [2] });

    await expect(
      processManualPages({ ...manual, pageCount: 3, status: "processing" }, fixture.dependencies),
    ).rejects.toMatchObject({
      failedPages: [2],
    });

    expect(fixture.renderedPages).toEqual([1, 2, 3]);
    expect(fixture.pages.map((page) => page.extractionStatus)).toEqual([
      "available",
      "failed",
      "available",
    ]);
    expect(fixture.pages[1]?.errorMessage).toContain("page 2");
  });

  it("retries failed and missing pages, then skips available pages without duplicate writes", async () => {
    const fixture = createPageDependencies({
      pageCount: 3,
      existingPages: [createPage(1), createPage(2, "failed")],
    });

    await processManualPages({ ...manual, pageCount: 3, status: "processing" }, fixture.dependencies);
    expect(fixture.renderedPages).toEqual([2, 3]);
    const firstWriteCount = fixture.saved.length;

    fixture.renderedPages.length = 0;
    await processManualPages({ ...manual, pageCount: 3, status: "processing" }, fixture.dependencies);

    expect(fixture.renderedPages).toEqual([]);
    expect(fixture.saved).toHaveLength(firstWriteCount);
    expect(fixture.pages).toHaveLength(3);
    expect(fixture.pages.every((page) => page.extractionStatus === "available")).toBe(true);
  });
});
