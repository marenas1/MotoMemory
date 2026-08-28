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

const { findCurrent, searchChunks } = vi.hoisted(() => ({
  findCurrent: vi.fn(),
  searchChunks: vi.fn(),
}));
const { getReadableScope } = vi.hoisted(() => ({ getReadableScope: vi.fn() }));

vi.mock("@/lib/data/manual-repository", () => ({
  manualRepository: { findCurrent, searchChunks },
}));
vi.mock("@/lib/server/read-access", () => ({ getReadableScope }));

import { TEST_SCOPE } from "@/tests/fixtures/test-scope";

import { POST } from "@/app/api/manual/search/route";

describe("manual search route boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReadableScope.mockResolvedValue({ scope: TEST_SCOPE, isOwner: true });
    findCurrent.mockResolvedValue(manual);
  });

  it("returns passages with PDF and printed page provenance", async () => {
    searchChunks.mockResolvedValue([
      {
        id: "chunk-1",
        manualId: manual.id,
        pageStart: 34,
        pageEnd: 34,
        printedPageStart: "31",
        printedPageEnd: "31",
        sectionLabel: null,
        content: "Replace oil every 2,000 miles.",
        processorVersion: "fake-ocr:v1",
        rank: 1,
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/manual/search", {
        method: "POST",
        body: JSON.stringify({ query: "oil interval" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      manualId: manual.id,
      passages: [{ pageStart: 34, printedPageStart: "31" }],
    });
    expect(searchChunks).toHaveBeenCalledWith(TEST_SCOPE, manual.id, "oil interval", 8);
  });

  it("rejects an empty query before searching", async () => {
    const response = await POST(
      new Request("http://localhost/api/manual/search", {
        method: "POST",
        body: JSON.stringify({ query: "   " }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(searchChunks).not.toHaveBeenCalled();
  });

  it("rejects unknown fields and string limits at the API boundary", async () => {
    const response = await POST(
      new Request("http://localhost/api/manual/search", {
        method: "POST",
        body: JSON.stringify({ query: "oil", limit: "8", extra: true }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(searchChunks).not.toHaveBeenCalled();
  });
});
