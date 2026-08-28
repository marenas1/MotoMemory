import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ManualDocumentRecord } from "@/lib/manual/manual-types";

const manual: ManualDocumentRecord = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  motorcycleId: "gs750",
  fileName: "manual.pdf",
  contentType: "application/pdf",
  storageKey: "manuals/gs750/123e4567-e89b-12d3-a456-426614174000.pdf",
  fileSizeBytes: 3_700_000,
  sha256: "a".repeat(64),
  pageCount: 67,
  status: "ready",
  extractionMethod: "ocr",
  errorMessage: null,
  uploadedAt: new Date(0).toISOString(),
  processedAt: new Date(0).toISOString(),
};

const { findCurrent } = vi.hoisted(() => ({
  findCurrent: vi.fn(),
}));
const { answerManualQuestion } = vi.hoisted(() => ({
  answerManualQuestion: vi.fn(),
}));
const { getReadableScope } = vi.hoisted(() => ({ getReadableScope: vi.fn() }));

vi.mock("@/lib/data/manual-repository", () => ({ manualRepository: { findCurrent } }));
vi.mock("@/lib/manual/manual-answering", () => ({ answerManualQuestion }));
vi.mock("@/lib/server/read-access", () => ({ getReadableScope }));

import { TEST_SCOPE } from "@/tests/fixtures/test-scope";

import { POST } from "@/app/api/manual/questions/route";

describe("manual question route boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReadableScope.mockResolvedValue({ scope: TEST_SCOPE, isOwner: true });
    findCurrent.mockResolvedValue(manual);
    answerManualQuestion.mockResolvedValue({
      state: "provider_unavailable",
      manual: {
        id: manual.id,
        fileName: manual.fileName,
        sha256: manual.sha256,
        pageCount: manual.pageCount,
      },
      passages: [],
      citations: [],
      message: "Answer generation is not configured.",
    });
  });

  it("rejects unknown input fields before invoking the answer boundary", async () => {
    const response = await POST(
      new Request("http://localhost/api/manual/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "What does the manual say?", limit: 3 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(answerManualQuestion).not.toHaveBeenCalled();
  });

  it("returns a strict provider-unavailable state without failing the route", async () => {
    const response = await POST(
      new Request("http://localhost/api/manual/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "What does the manual say?" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      state: "provider_unavailable",
      manual: { id: manual.id },
    });
    expect(answerManualQuestion).toHaveBeenCalledWith(
      TEST_SCOPE,
      manual,
      "What does the manual say?",
    );
  });

  it("returns source-backed citations that retain the PDF page target", async () => {
    answerManualQuestion.mockResolvedValue({
      state: "supported_evidence",
      manual: {
        id: manual.id,
        fileName: manual.fileName,
        sha256: manual.sha256,
        pageCount: manual.pageCount,
      },
      passages: [{
        id: "chunk-1",
        manualId: manual.id,
        pageStart: 34,
        pageEnd: 34,
        printedPageStart: "31",
        printedPageEnd: "31",
        sectionLabel: "Maintenance",
        content: "Replace engine oil every 2,000 miles.",
        processorVersion: "fake-ocr:v1",
        citationHref: "/manual?page=34&printedPage=31",
      }],
      answer: "Replace engine oil every 2,000 miles.",
      citations: [{
        passageId: "chunk-1",
        manualId: manual.id,
        pdfPageStart: 34,
        pdfPageEnd: 34,
        printedPageStart: "31",
        printedPageEnd: "31",
        href: "/manual?page=34&printedPage=31",
      }],
    });

    const response = await POST(
      new Request("http://localhost/api/manual/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "What oil interval does the manual specify?" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      state: "supported_evidence",
      citations: [{
        pdfPageStart: 34,
        printedPageStart: "31",
        href: "/manual?page=34&printedPage=31",
      }],
    });
  });
});
