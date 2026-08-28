import { stat } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { uploadManualDocument } from "@/lib/manual/manual-upload";
import type {
  ManualDocumentRecord,
  PdfPageImage,
  PdfReader,
} from "@/lib/manual/manual-types";
import { TEST_SCOPE } from "@/tests/fixtures/test-scope";

const pdfBytes = new TextEncoder().encode("%PDF-1.7\nmanual test bytes\n%%EOF");

function createRecord(overrides: Partial<ManualDocumentRecord> = {}): ManualDocumentRecord {
  return {
    id: "123e4567-e89b-12d3-a456-426614174000",
    motorcycleId: "gs750",
    fileName: "manual.pdf",
    contentType: "application/pdf",
    storageKey: "manuals/gs750/123e4567-e89b-12d3-a456-426614174000.pdf",
    fileSizeBytes: pdfBytes.byteLength,
    sha256: "a".repeat(64),
    pageCount: 67,
    status: "uploaded",
    extractionMethod: "ocr",
    errorMessage: null,
    uploadedAt: new Date(0).toISOString(),
    processedAt: null,
    ...overrides,
  };
}

function createPdfReader(pageCount: number): PdfReader {
  return {
    getPageCount: async (pdfPath) => {
      await stat(pdfPath);
      return pageCount;
    },
    renderPage: async (_pdfPath, pageNumber): Promise<PdfPageImage> => ({
      pageNumber,
      mimeType: "image/png",
      bytes: new Uint8Array([pageNumber]),
    }),
  };
}

function createDependencies(overrides: {
  findBySha256?: () => Promise<ManualDocumentRecord | null>;
  findCurrent?: () => Promise<ManualDocumentRecord | null>;
  pageCount?: number;
} = {}) {
  const put = vi.fn(
    async (
      _storageKey: string,
      _bytes: Uint8Array,
      _contentType: string,
    ): Promise<void> => undefined,
  );
  const createDocument = vi.fn(async () => createRecord());

  return {
    dependencies: {
      repository: {
        findBySha256: overrides.findBySha256 ?? (async () => null),
        findCurrent: overrides.findCurrent ?? (async () => null),
        createDocument,
      },
      storage: {
        put,
        get: async () => ({
          bytes: pdfBytes,
          contentType: "application/pdf",
        }),
        remove: async () => undefined,
      },
      pdfReader: createPdfReader(overrides.pageCount ?? 67),
    },
    put,
    createDocument,
  };
}

describe("manual upload boundary", () => {
  it("parses the page count before storing a valid PDF", async () => {
    const { dependencies, put, createDocument } = createDependencies();

    const record = await uploadManualDocument(
      {
        scope: TEST_SCOPE,
        fileName: "gs750-manual.pdf",
        contentType: "application/pdf",
        bytes: pdfBytes,
      },
      dependencies,
    );

    expect(record.status).toBe("uploaded");
    expect(createDocument).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledOnce();
    expect(put.mock.calls[0]?.[2]).toBe("application/pdf");
  });

  it("rejects an identical document before invoking the PDF reader or storage", async () => {
    const reader = vi.fn();
    const { dependencies, put } = createDependencies({
      findBySha256: async () => createRecord(),
    });
    dependencies.pdfReader = {
      getPageCount: reader,
      renderPage: async () => ({
        pageNumber: 1,
        mimeType: "image/png",
        bytes: new Uint8Array(),
      }),
    };

    await expect(
      uploadManualDocument(
        {
          scope: TEST_SCOPE,
          fileName: "duplicate.pdf",
          contentType: "application/pdf",
          bytes: pdfBytes,
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "MANUAL_DUPLICATE", status: 409 });

    expect(reader).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a second different document under the single-manual scope", async () => {
    const { dependencies, put } = createDependencies({
      findCurrent: async () => createRecord({ sha256: "b".repeat(64) }),
    });

    await expect(
      uploadManualDocument(
        {
          scope: TEST_SCOPE,
          fileName: "replacement.pdf",
          contentType: "application/pdf",
          bytes: pdfBytes,
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "MANUAL_ALREADY_EXISTS", status: 409 });

    expect(put).not.toHaveBeenCalled();
  });

  it("rejects non-PDF content even when the form content type says PDF", async () => {
    const { dependencies, put } = createDependencies();

    await expect(
      uploadManualDocument(
        {
          scope: TEST_SCOPE,
          fileName: "not-a-manual.pdf",
          contentType: "application/pdf",
          bytes: new TextEncoder().encode("plain text"),
        },
        dependencies,
      ),
    ).rejects.toThrow("valid PDF header");

    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a PDF over the page limit before storage", async () => {
    const { dependencies, put } = createDependencies({ pageCount: 101 });

    await expect(
      uploadManualDocument(
        {
          scope: TEST_SCOPE,
          fileName: "too-long.pdf",
          contentType: "application/pdf",
          bytes: pdfBytes,
        },
        dependencies,
      ),
    ).rejects.toThrow("100 pages");

    expect(put).not.toHaveBeenCalled();
  });
});
