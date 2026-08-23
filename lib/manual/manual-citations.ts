import type { ManualChunkRecord, ManualPassage } from "@/lib/manual/manual-types";

export function buildManualCitationHref(
  pdfPage: number,
  printedPageLabel: string | null,
): string {
  const parameters = new URLSearchParams({ page: String(pdfPage) });
  if (printedPageLabel) {
    parameters.set("printedPage", printedPageLabel);
  }

  return `/manual?${parameters.toString()}`;
}

export function toManualPassage(passage: ManualChunkRecord): ManualPassage {
  return {
    ...passage,
    citationHref: buildManualCitationHref(
      passage.pageStart,
      passage.printedPageStart,
    ),
  };
}

export function isPassageWithinManual(
  passage: ManualChunkRecord,
  manualId: string,
  pageCount: number,
): boolean {
  return (
    passage.manualId === manualId &&
    passage.pageStart >= 1 &&
    passage.pageEnd >= passage.pageStart &&
    passage.pageEnd <= pageCount
  );
}
