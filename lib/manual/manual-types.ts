import type {
  MaintenanceFactOrigin,
  MaintenanceIntervalUnit,
  MotorcycleOverview,
} from "@/lib/domain/types";

export interface PdfPageImage {
  pageNumber: number;
  mimeType: "image/png";
  bytes: Uint8Array;
}

export interface PdfReader {
  getPageCount(pdfPath: string): Promise<number>;
  renderPage(pdfPath: string, pageNumber: number): Promise<PdfPageImage>;
}

export interface OcrContext {
  pageNumber: number;
}

export interface OcrResult {
  pageNumber: number;
  text: string;
  engine: string;
}

export interface OcrAdapter {
  readonly name: string;
  recognize(image: PdfPageImage, context: OcrContext): Promise<OcrResult>;
}

export interface PageProvenance {
  pdfPageNumber: number;
  printedPageLabel: string | null;
  extractedText: string;
}

export type ManualPageExtractionStatus = "available" | "failed";

export interface ManualPageRecord {
  id: string;
  manualId: string;
  pageNumber: number;
  printedPageLabel: string | null;
  extractedText: string | null;
  extractionStatus: ManualPageExtractionStatus;
  errorMessage: string | null;
  ocrEngine: string | null;
  processedAt: string | null;
}

export interface ManualChunkRecord {
  id: string;
  manualId: string;
  pageStart: number;
  pageEnd: number;
  printedPageStart: string | null;
  printedPageEnd: string | null;
  sectionLabel: string | null;
  content: string;
  processorVersion: string | null;
  rank?: number;
}

export interface ManualPassage extends ManualChunkRecord {
  citationHref: string;
}

export interface ManualCitation {
  passageId: string;
  manualId: string;
  pdfPageStart: number;
  pdfPageEnd: number;
  printedPageStart: string | null;
  printedPageEnd: string | null;
  href: string;
}

export interface ManualIdentity {
  id: string;
  fileName: string;
  sha256: string;
  pageCount: number;
}

export interface ManualIngestionProgress {
  totalPages: number;
  accountedPages: number;
  availablePages: number;
  failedPages: number;
  pendingPages: number;
  percentComplete: number;
  failures: ManualPageFailure[];
}

export interface ManualPageFailure {
  pageNumber: number;
  errorMessage: string | null;
}

export interface ManualPageUpsertInput {
  pageNumber: number;
  printedPageLabel: string | null;
  extractedText: string | null;
  extractionStatus: ManualPageExtractionStatus;
  errorMessage: string | null;
  ocrEngine: string | null;
}

export interface ManualChunkInput {
  pageStart: number;
  pageEnd: number;
  printedPageStart: string | null;
  printedPageEnd: string | null;
  sectionLabel: string | null;
  content: string;
  processorVersion: string;
}

export interface ManualMaintenanceFactInput {
  name: string;
  intervalValue: number;
  intervalUnit: MaintenanceIntervalUnit;
  intervalMiles: number;
  notes: string | null;
  sourceManualId: string;
  sourcePageStart: number;
  sourcePageEnd: number;
  sourcePrintedPageLabel: string | null;
  rawOcrContext: string;
}

export interface ManualMaintenanceFactRecord {
  id: string;
  motorcycleId: string;
  name: string;
  intervalValue: number;
  intervalUnit: MaintenanceIntervalUnit;
  intervalMiles: number;
  dueWindowMiles: number;
  status: "active";
  source: string;
  notes: string | null;
  sourceManualId: string;
  sourcePageStart: number;
  sourcePageEnd: number;
  sourcePrintedPageLabel: string | null;
  rawOcrContext: string | null;
  origin: MaintenanceFactOrigin;
  correctedAt: string | null;
  sourceHref: string;
}

export interface MaintenanceFactCorrectionInput {
  name?: string;
  intervalValue?: number;
  intervalUnit?: MaintenanceIntervalUnit;
  notes?: string | null;
}

export interface MaintenanceFactCorrectionResult {
  fact: ManualMaintenanceFactRecord;
  overview: MotorcycleOverview;
}

export type ManualDocumentStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";

export interface ManualDocumentRecord {
  id: string;
  motorcycleId: string;
  fileName: string;
  contentType: "application/pdf";
  storageKey: string;
  fileSizeBytes: number;
  sha256: string;
  pageCount: number;
  status: ManualDocumentStatus;
  extractionMethod: "ocr";
  errorMessage: string | null;
  uploadedAt: string;
  processedAt: string | null;
}

/**
 * The shape safe for browser/API consumers. Storage identity stays server-only.
 */
export type PublicManualDocumentRecord = Omit<ManualDocumentRecord, "storageKey">;
