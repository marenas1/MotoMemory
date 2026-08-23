import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildManualFileUrl,
  ManualPdfViewer,
} from "@/components/manual-pdf-viewer";
import type { PublicManualDocumentRecord } from "@/lib/manual/manual-types";

const manual: PublicManualDocumentRecord = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  motorcycleId: "gs750",
  fileName: "gs750-manual.pdf",
  contentType: "application/pdf",
  fileSizeBytes: 3_700_000,
  sha256: "a".repeat(64),
  pageCount: 67,
  status: "ready",
  extractionMethod: "ocr",
  errorMessage: null,
  uploadedAt: new Date(0).toISOString(),
  processedAt: new Date(0).toISOString(),
};

describe("native manual PDF viewer", () => {
  it("builds a private file target with a PDF page fragment", () => {
    expect(buildManualFileUrl(34)).toBe("/api/manual/file#page=34");
  });

  it("shows PDF page index and printed page label as separate values", () => {
    const markup = renderToStaticMarkup(
      <ManualPdfViewer
        manual={manual}
        initialPageTarget={34}
        initialPrintedPageLabel="31"
      />,
    );

    expect(markup).toContain("PDF page index");
    expect(markup).toContain("Printed page label");
    expect(markup).toContain(">34</dd>");
    expect(markup).toContain(">31</dd>");
    expect(markup).toContain("/api/manual/file#page=34");
    expect(markup).not.toContain("storageKey");
    expect(markup).not.toContain("supabase");
  });

  it("renders an explicit unavailable label when no printed label is known", () => {
    const markup = renderToStaticMarkup(
      <ManualPdfViewer
        manual={manual}
        initialPageTarget={1}
        initialPrintedPageLabel={null}
      />,
    );

    expect(markup).toContain("Printed page label");
    expect(markup).toContain("Not available");
  });

  it("does not silently open the wrong page for an invalid citation target", () => {
    const markup = renderToStaticMarkup(
      <ManualPdfViewer
        manual={manual}
        initialPageTarget={99}
        initialPrintedPageLabel={null}
      />,
    );

    expect(markup).toContain("Invalid citation target");
    expect(markup).toContain("requested PDF page is 99");
    expect(markup).not.toContain("<iframe");
  });
});
