import type { PageProvenance } from "@/lib/manual/manual-types";

const EXPLICIT_LABEL_PATTERN =
  /^(?:page|p\.)\s*[:.#-]?\s*([0-9]{1,4}|[ivxlcdm]{1,12})$/i;
const STANDALONE_LABEL_PATTERN = /^(?:[0-9]{1,4}|[ivxlcdm]{1,12})$/i;

function normalizeLine(line: string): string {
  return line.replaceAll(/\s+/g, " ").trim();
}

function getCandidateLines(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  return [...lines.slice(0, 10), ...lines.slice(-10)];
}

/**
 * Returns the printed label only when OCR presents a strong page-label shape.
 * Ambiguous body text is intentionally left as null instead of being guessed.
 */
export function detectPrintedPageLabel(text: string): string | null {
  const candidates = getCandidateLines(text);

  for (const candidate of candidates) {
    const explicitMatch = candidate.match(EXPLICIT_LABEL_PATTERN);
    if (explicitMatch?.[1]) {
      return explicitMatch[1];
    }
  }

  const standaloneCandidates = candidates.filter((candidate) =>
    STANDALONE_LABEL_PATTERN.test(candidate),
  );

  return standaloneCandidates.at(-1) ?? null;
}

export function buildPageProvenance(
  pdfPageNumber: number,
  extractedText: string,
): PageProvenance {
  if (!Number.isInteger(pdfPageNumber) || pdfPageNumber < 1) {
    throw new Error("PDF page number must be a positive integer.");
  }

  return {
    pdfPageNumber,
    printedPageLabel: detectPrintedPageLabel(extractedText),
    extractedText,
  };
}
