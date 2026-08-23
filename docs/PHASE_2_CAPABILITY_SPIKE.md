# Phase 2 Capability Spike Record

Status: conditional until the owner supplies the real scanned manual and the
local OCR prerequisite is installed.

## Purpose

This record covers Phase 1 of the Phase 2 implementation plan: prove that the
67-page scanned manual can be opened, rendered, OCR'd, and traced back to its
original PDF page without placing the copyrighted PDF in Git.

## Selected local approach

The first implementation candidate is a server-only/local-worker adapter:

```text
PDF file → pdfinfo (page count) → pdftoppm (PNG page render) →
Tesseract CLI (English OCR) → page-aware OCR result
```

The application-facing boundary is in `lib/manual/manual-types.ts`:

- `PdfReader` owns page count and page rendering.
- `OcrAdapter` owns OCR and returns the same 1-based page number as the input
  image.
- `buildPageProvenance` retains the PDF page number and an optional printed
  page label.

The adapter uses `node:child_process` with argument arrays, not a shell. PDF
bytes are read from the supplied local path, rendered into an operating-system
temporary directory, and removed after each sample page. No source PDF or OCR
image is written to the repository.

## Exact acceptance command

Keep the owner PDF outside the repository and run:

```bash
npm run manual:capability -- /absolute/path/to/the/67-page-manual.pdf \
  --sample-pages 1,34,67
```

For the Phase 5 full-page acceptance check, use the same private path with:

```bash
npm run manual:ocr:acceptance -- /absolute/path/to/the/67-page-manual.pdf \
  --all-pages
```

This exercises all 67 pages without placing the PDF, rendered images, or OCR
output in Git.

The default sample is page 1, the middle page, and the final page. The command
prints page count, renderer/OCR status, searchable-text status, PDF-page
correlation, printed page label when detected, and a short OCR preview. It
does not save the PDF, page images, or OCR text under the repository.

The command ends with `CAPABILITY_SPIKE_GO` only when every requested sample
page renders, produces non-empty OCR text, and preserves its page mapping. A
missing PDF, missing tool, parse failure, render failure, or OCR failure ends
with `CAPABILITY_SPIKE_CONDITIONAL` and exit status 2.

## Local prerequisites

The current environment has Poppler's `pdfinfo` and `pdftoppm`, but does not
have `tesseract`. Install the equivalent packages for the local operating
system before running the acceptance command. Common package-manager examples
are:

```bash
# Debian/Ubuntu
sudo apt-get install poppler-utils tesseract-ocr

# macOS with Homebrew
brew install poppler tesseract
```

The commands can be overridden for a local worker environment with:

```bash
MOTOMEMORY_PDFINFO_COMMAND=/path/to/pdfinfo \
MOTOMEMORY_PDF_RENDER_COMMAND=/path/to/pdftoppm \
MOTOMEMORY_OCR_COMMAND=/path/to/tesseract \
npm run manual:capability -- /absolute/path/to/the/67-page-manual.pdf
```

## Current evidence

| Check | Result |
|---|---|
| Owner PDF available in the workspace | No; intentionally not fabricated or committed |
| PDF page-count adapter | Implemented with `pdfinfo`; local executable present |
| PDF page-render adapter | Implemented with `pdftoppm`; local executable present |
| OCR adapter | Implemented with Tesseract CLI; local executable absent |
| Page mapping tests | Passing with injected reader/OCR doubles |
| Printed-label behavior tests | Passing; ambiguous labels remain blank |
| Real 67-page sample | Pending the exact owner-supplied path and Tesseract installation |

## Decision

Use the `PdfReader` and `OcrAdapter` boundaries for the next phase. Keep the
first production candidate as Poppler rendering plus Tesseract CLI in a
server-side Node/local-worker process. The actual manual sample remains the
required evidence before declaring the OCR engine fully selected. If that
sample fails the Phase 2 Go criteria, replace only the adapters; do not move
PDF handling or OCR into the browser.
