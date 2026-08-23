import { describe, expect, it } from "vitest";

import { createPageChunks } from "@/lib/manual/chunking";
import { searchManualChunks } from "@/lib/manual/retrieval";
import type { ManualChunkRecord, PageProvenance } from "@/lib/manual/manual-types";

const provenance: PageProvenance = {
  pdfPageNumber: 34,
  printedPageLabel: "31",
  extractedText: "Oil change interval\nReplace the oil every 2,000 miles.",
};

const result: ManualChunkRecord = {
  id: "chunk-1",
  manualId: "manual-1",
  pageStart: 34,
  pageEnd: 34,
  printedPageStart: "31",
  printedPageEnd: "31",
  sectionLabel: null,
  content: provenance.extractedText,
  processorVersion: "fake-ocr:v1",
  rank: 1,
};

describe("page-aware manual retrieval", () => {
  it("creates chunks with both PDF and printed page provenance", () => {
    expect(createPageChunks(provenance, "fake-ocr:v1")).toEqual([
      expect.objectContaining({
        pageStart: 34,
        pageEnd: 34,
        printedPageStart: "31",
        printedPageEnd: "31",
        content: provenance.extractedText,
      }),
    ]);
  });

  it("deduplicates repeated OCR paragraphs before persistence", () => {
    expect(
      createPageChunks({
        ...provenance,
        extractedText: "Repeated heading\n\nRepeated heading\n\nUnique detail",
      }),
    ).toEqual([
      expect.objectContaining({ content: "Repeated heading" }),
      expect.objectContaining({ content: "Unique detail" }),
    ]);
  });

  it("returns source-linked passages and validates empty queries", async () => {
    const searchChunks = async (manualId: string, query: string, limit: number) => {
      expect(manualId).toBe("manual-1");
      expect(query).toBe("oil interval");
      expect(limit).toBe(8);
      return [result];
    };

    await expect(
      searchManualChunks("manual-1", " oil interval ", {
        repository: { searchChunks },
      }),
    ).resolves.toEqual([result]);

    await expect(
      searchManualChunks("manual-1", "   ", { repository: { searchChunks } }),
    ).rejects.toMatchObject({ code: "INVALID_MANUAL", status: 400 });
  });
});
