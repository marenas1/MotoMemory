import type { ManualChunkInput, PageProvenance } from "@/lib/manual/manual-types";

export const DEFAULT_MANUAL_PROCESSOR_VERSION = "tesseract-cli-v1";
export const DEFAULT_CHUNK_MAX_CHARACTERS = 1_600;

function normalizeText(text: string): string {
  return text
    .replaceAll(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
}

function splitParagraph(paragraph: string, maxCharacters: number): string[] {
  if (paragraph.length <= maxCharacters) {
    return [paragraph];
  }

  const words = paragraph.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      if (word.length <= maxCharacters) {
        current = word;
        continue;
      }

      for (let offset = 0; offset < word.length; offset += maxCharacters) {
        parts.push(word.slice(offset, offset + maxCharacters));
      }
      continue;
    }

    const candidate = `${current} ${word}`;
    if (candidate.length <= maxCharacters) {
      current = candidate;
      continue;
    }

    parts.push(current);
    current = word;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

export function splitPageText(
  text: string,
  maxCharacters = DEFAULT_CHUNK_MAX_CHARACTERS,
): string[] {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) {
    throw new Error("Chunk maximum character count must be a positive integer.");
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => splitParagraph(paragraph, maxCharacters));
}

export function createPageChunks(
  provenance: PageProvenance,
  processorVersion = DEFAULT_MANUAL_PROCESSOR_VERSION,
  maxCharacters = DEFAULT_CHUNK_MAX_CHARACTERS,
): ManualChunkInput[] {
  const seen = new Set<string>();
  const parts = splitPageText(provenance.extractedText, maxCharacters).filter((content) => {
    if (seen.has(content)) {
      return false;
    }

    seen.add(content);
    return true;
  });

  return parts.map((content) => ({
    pageStart: provenance.pdfPageNumber,
    pageEnd: provenance.pdfPageNumber,
    printedPageStart: provenance.printedPageLabel,
    printedPageEnd: provenance.printedPageLabel,
    sectionLabel: null,
    content,
    processorVersion,
  }));
}
