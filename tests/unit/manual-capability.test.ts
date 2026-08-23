import { describe, expect, it } from "vitest";

import {
  runCapabilitySpike,
  selectSamplePages,
} from "@/lib/manual/capability-spike";
import { buildPageProvenance, detectPrintedPageLabel } from "@/lib/manual/page-provenance";
import type {
  OcrAdapter,
  PdfPageImage,
  PdfReader,
} from "@/lib/manual/manual-types";
import { TesseractCliOcrAdapter } from "@/lib/manual/ocr";

describe("manual capability spike", () => {
  it("selects first, middle, and final PDF pages without duplicates", () => {
    expect(selectSamplePages(67)).toEqual([1, 34, 67]);
    expect(selectSamplePages(2)).toEqual([1, 2]);
    expect(selectSamplePages(1)).toEqual([1]);
  });

  it("keeps OCR tied to the rendered one-based PDF page", async () => {
    const reader: PdfReader = {
      getPageCount: async () => 67,
      renderPage: async (_pdfPath, pageNumber): Promise<PdfPageImage> => ({
        pageNumber,
        mimeType: "image/png",
        bytes: new Uint8Array([pageNumber]),
      }),
    };
    const ocr: OcrAdapter = {
      name: "fake-ocr",
      recognize: async (image) => ({
        pageNumber: image.pageNumber,
        text: `Manual page ${image.pageNumber}\nPage ${image.pageNumber}`,
        engine: "fake-ocr",
      }),
    };

    const report = await runCapabilitySpike("/private/manual.pdf", {
      reader,
      ocr,
    });

    expect(report.passed).toBe(true);
    expect(report.pages).toHaveLength(3);
    expect(report.pages.every((page) => page.correlationVerified)).toBe(true);
    expect(report.pages.map((page) => page.printedPageLabel)).toEqual([
      "1",
      "34",
      "67",
    ]);
  });

  it("records an OCR failure without losing the source page mapping", async () => {
    const reader: PdfReader = {
      getPageCount: async () => 1,
      renderPage: async (_pdfPath, pageNumber) => ({
        pageNumber,
        mimeType: "image/png",
        bytes: new Uint8Array([1]),
      }),
    };
    const ocr: OcrAdapter = {
      name: "failing-ocr",
      recognize: async () => {
        throw new Error("OCR unavailable");
      },
    };

    const report = await runCapabilitySpike("/private/manual.pdf", {
      reader,
      ocr,
    });

    expect(report.passed).toBe(false);
    expect(report.pages[0]).toMatchObject({
      pageNumber: 1,
      rendered: true,
      errorStage: "ocr",
      errorMessage: "OCR unavailable",
    });
  });

  it("rejects an OCR call whose context points at a different PDF page", async () => {
    const adapter = new TesseractCliOcrAdapter({
      command: "missing-tesseract-for-test",
    });

    await expect(
      adapter.recognize(
        {
          pageNumber: 3,
          mimeType: "image/png",
          bytes: new Uint8Array([1]),
        },
        { pageNumber: 4 },
      ),
    ).rejects.toThrow("does not match");
  });
});

describe("printed page labels", () => {
  it("prefers explicit labels near the page edges", () => {
    expect(
      detectPrintedPageLabel("SERVICE MANUAL\nChapter 2\nPage 42\nBody"),
    ).toBe("42");
    expect(detectPrintedPageLabel("Appendix\n\nix\n")).toBe("ix");
  });

  it("leaves ambiguous pages unlabeled", () => {
    expect(detectPrintedPageLabel("SERVICE MANUAL\nChapter 2\nBody text")).toBe(
      null,
    );
    expect(buildPageProvenance(4, "Body text")).toMatchObject({
      pdfPageNumber: 4,
      printedPageLabel: null,
    });
  });
});
