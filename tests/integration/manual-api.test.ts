import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ManualDocumentRecord } from "@/lib/manual/manual-types";
import { AppError } from "@/lib/server/errors";

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

function expectedApiManual() {
  const metadata = { ...manual };
  Reflect.deleteProperty(metadata, "storageKey");
  return metadata;
}

const {
  findCurrent,
  getIngestionProgress,
  uploadConfiguredManual,
  startConfiguredManualIngestion,
  enqueueConfiguredManualIngestion,
} = vi.hoisted(() => ({
  findCurrent: vi.fn<() => Promise<ManualDocumentRecord | null>>(),
  getIngestionProgress: vi.fn(),
  uploadConfiguredManual: vi.fn<
    (input: {
      fileName: string;
      contentType: string;
      bytes: Uint8Array;
    }) => Promise<ManualDocumentRecord>
  >(),
  startConfiguredManualIngestion: vi.fn(),
  enqueueConfiguredManualIngestion: vi.fn(),
}));

vi.mock("@/lib/data/manual-repository", () => ({
  manualRepository: { findCurrent, getIngestionProgress },
}));
vi.mock("@/lib/manual/manual-upload", () => ({
  uploadConfiguredManual,
}));
vi.mock("@/lib/manual/manual-ingestion", () => ({
  startConfiguredManualIngestion,
  enqueueConfiguredManualIngestion,
}));

import { GET, POST } from "@/app/api/manual/route";
import { POST as POST_INGEST } from "@/app/api/manual/ingest/route";

describe("manual API route boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the current manual metadata and status", async () => {
    findCurrent.mockResolvedValue(manual);
    getIngestionProgress.mockResolvedValue({
      totalPages: 67,
      accountedPages: 0,
      availablePages: 0,
      failedPages: 0,
      pendingPages: 67,
      percentComplete: 0,
      failures: [],
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.manual).toEqual(expectedApiManual());
    expect(payload.manual).not.toHaveProperty("storageKey");
    expect(payload.progress).toMatchObject({ totalPages: 67, pendingPages: 67 });
  });

  it("accepts a PDF multipart upload and returns created metadata", async () => {
    uploadConfiguredManual.mockResolvedValue(manual);
    const formData = new FormData();
    formData.append(
      "file",
      new File([new TextEncoder().encode("%PDF-1.7")], "manual.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/manual", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.manual).toEqual(expectedApiManual());
    expect(payload.manual).not.toHaveProperty("storageKey");
    expect(uploadConfiguredManual).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "manual.pdf",
        contentType: "application/pdf",
      }),
    );
  });

  it("rejects a non-PDF content type before the upload service", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new File([new TextEncoder().encode("%PDF-1.7")], "manual.pdf", {
        type: "application/octet-stream",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/manual", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_MANUAL" },
    });
    expect(uploadConfiguredManual).not.toHaveBeenCalled();
  });

  it("returns a conflict for an identical upload without exposing storage identity", async () => {
    uploadConfiguredManual.mockRejectedValue(
      new AppError(
        "MANUAL_DUPLICATE",
        "An identical manual is already uploaded for the GS750.",
        409,
      ),
    );

    const formData = new FormData();
    formData.append(
      "file",
      new File([new TextEncoder().encode("%PDF-1.7")], "manual-copy.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/manual", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MANUAL_DUPLICATE" },
    });
  });

  it("returns failed page accounting while retaining the source manual metadata", async () => {
    findCurrent.mockResolvedValue({ ...manual, status: "failed", errorMessage: "OCR failed for PDF page 2." });
    getIngestionProgress.mockResolvedValue({
      totalPages: 3,
      accountedPages: 3,
      availablePages: 2,
      failedPages: 1,
      pendingPages: 0,
      percentComplete: 100,
      failures: [{ pageNumber: 2, errorMessage: "OCR failed for PDF page 2." }],
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      manual: {
        status: "failed",
        errorMessage: "OCR failed for PDF page 2.",
      },
      progress: {
        failedPages: 1,
        failures: [{ pageNumber: 2 }],
      },
    });
  });

  it("starts processing and returns 202 without claiming ready", async () => {
    startConfiguredManualIngestion.mockResolvedValue({ manual: { ...manual, status: "processing" }, started: true });
    enqueueConfiguredManualIngestion.mockResolvedValue({ ...manual, status: "ready" });

    const response = await POST_INGEST();

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      started: true,
      manual: { status: "processing" },
    });
    expect(enqueueConfiguredManualIngestion).toHaveBeenCalledWith(manual.id);
  });
});
