import "server-only";

import { buildPageProvenance } from "@/lib/manual/page-provenance";
import { createLocalPdfReader } from "@/lib/manual/pdf-reader";
import { TesseractCliOcrAdapter } from "@/lib/manual/ocr";
import type {
  OcrAdapter,
  PageProvenance,
  PdfReader,
} from "@/lib/manual/manual-types";

export interface CapabilityDependencies {
  reader: PdfReader;
  ocr: OcrAdapter;
}

export interface CapabilityPageResult {
  pageNumber: number;
  rendered: boolean;
  searchable: boolean;
  printedPageLabel: string | null;
  ocrPageNumber: number | null;
  correlationVerified: boolean;
  textPreview: string;
  errorStage: "render" | "ocr" | null;
  errorMessage: string | null;
}

export interface CapabilitySpikeReport {
  pdfPath: string;
  pageCount: number;
  samplePages: number[];
  ocrEngine: string;
  pages: CapabilityPageResult[];
  passed: boolean;
}

export function selectSamplePages(pageCount: number, sampleSize = 3): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("PDF page count must be a positive integer.");
  }

  if (!Number.isInteger(sampleSize) || sampleSize < 1) {
    throw new Error("Sample size must be a positive integer.");
  }

  const candidates = [
    1,
    Math.ceil(pageCount / 2),
    pageCount,
  ];

  return [...new Set(candidates)].slice(0, sampleSize);
}

function getTextPreview(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim().slice(0, 160);
}

function createFailureResult(
  pageNumber: number,
  errorStage: CapabilityPageResult["errorStage"],
  error: unknown,
): CapabilityPageResult {
  return {
    pageNumber,
    rendered: errorStage !== "render",
    searchable: false,
    printedPageLabel: null,
    ocrPageNumber: null,
    correlationVerified: false,
    textPreview: "",
    errorStage,
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

export async function runCapabilitySpike(
  pdfPath: string,
  dependencies: CapabilityDependencies = {
    reader: createLocalPdfReader(),
    ocr: new TesseractCliOcrAdapter(),
  },
): Promise<CapabilitySpikeReport> {
  const pageCount = await dependencies.reader.getPageCount(pdfPath);
  const samplePages = selectSamplePages(pageCount);
  const pages: CapabilityPageResult[] = [];

  for (const pageNumber of samplePages) {
    let image;
    try {
      image = await dependencies.reader.renderPage(pdfPath, pageNumber);
    } catch (error) {
      pages.push(createFailureResult(pageNumber, "render", error));
      continue;
    }

    try {
      const ocrResult = await dependencies.ocr.recognize(image, { pageNumber });
      const provenance: PageProvenance = buildPageProvenance(
        pageNumber,
        ocrResult.text,
      );

      pages.push({
        pageNumber,
        rendered: true,
        searchable: provenance.extractedText.trim().length > 0,
        printedPageLabel: provenance.printedPageLabel,
        ocrPageNumber: ocrResult.pageNumber,
        correlationVerified: ocrResult.pageNumber === pageNumber,
        textPreview: getTextPreview(provenance.extractedText),
        errorStage: null,
        errorMessage: null,
      });
    } catch (error) {
      pages.push(createFailureResult(pageNumber, "ocr", error));
    }
  }

  return {
    pdfPath,
    pageCount,
    samplePages,
    ocrEngine: dependencies.ocr.name,
    pages,
    passed:
      pageCount > 0 &&
      pages.length === samplePages.length &&
      pages.every(
        (page) =>
          page.rendered &&
          page.searchable &&
          page.correlationVerified &&
          page.errorStage === null,
      ),
  };
}
