"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  PublicManualDocumentRecord,
} from "@/lib/manual/manual-types";

function clampPage(page: number | null, pageCount: number): number {
  if (!page || !Number.isInteger(page) || page < 1) {
    return 1;
  }

  return Math.min(page, pageCount);
}

export function buildManualFileUrl(page: number): string {
  return `/api/manual/file#page=${page}`;
}

export function ManualPdfViewer({
  manual,
  initialPageTarget,
  initialPrintedPageLabel,
}: {
  manual: PublicManualDocumentRecord;
  initialPageTarget: number | null;
  initialPrintedPageLabel: string | null;
}) {
  const initialPage = clampPage(initialPageTarget, manual.pageCount);
  const initialHasInvalidPageTarget =
    initialPageTarget !== null && initialPageTarget > manual.pageCount;
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [printedPageLabel, setPrintedPageLabel] = useState(initialPrintedPageLabel);
  const [hasInvalidPageTarget, setHasInvalidPageTarget] = useState(initialHasInvalidPageTarget);
  const [viewerAttempt, setViewerAttempt] = useState(0);
  const [viewerState, setViewerState] = useState<"checking" | "loading" | "loaded" | "unavailable">(
    initialHasInvalidPageTarget ? "unavailable" : "checking",
  );
  const fileUrl = useMemo(() => buildManualFileUrl(page), [page]);

  useEffect(() => {
    if (hasInvalidPageTarget) {
      return undefined;
    }

    let cancelled = false;

    async function checkOriginalPdf() {
      try {
        const response = await fetch("/api/manual/file", {
          method: "HEAD",
          cache: "no-store",
        });
        if (!response.ok || response.headers.get("content-type")?.split(";", 1)[0] !== "application/pdf") {
          throw new Error("The original PDF could not be loaded.");
        }
        if (!cancelled) {
          setViewerState("loading");
        }
      } catch {
        if (!cancelled) {
          setViewerState("unavailable");
        }
      }
    }

    void checkOriginalPdf();
    return () => {
      cancelled = true;
    };
  }, [hasInvalidPageTarget, fileUrl, viewerAttempt]);

  function submitPageTarget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedPage = Number(pageInput);
    if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > manual.pageCount) {
      setPageInput(String(page));
      return;
    }

    setPage(requestedPage);
    setHasInvalidPageTarget(false);
    setPrintedPageLabel(null);
    setViewerState("checking");
    window.history.replaceState(
      null,
      "",
      `/manual?page=${requestedPage}`,
    );
  }

  return (
    <section className="manual-viewer-card panel" aria-labelledby="manual-viewer-heading">
      <div className="panel-heading manual-viewer-heading">
        <div>
          <p className="eyebrow">Original document</p>
          <h2 id="manual-viewer-heading">Private PDF viewer</h2>
        </div>
        <a className="button button-outline" href={fileUrl} target="_blank" rel="noreferrer">
          Open in new tab
        </a>
      </div>

      <div className="manual-page-target-bar">
        <form className="manual-page-form" method="get" action="/manual" onSubmit={submitPageTarget}>
          <label htmlFor="manual-page-target">PDF page index</label>
          <div className="manual-page-form-controls">
            <input
              id="manual-page-target"
              name="page"
              type="number"
              min="1"
              max={manual.pageCount}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              inputMode="numeric"
            />
            <span>of {manual.pageCount}</span>
            <button className="button button-outline" type="submit">Go to page</button>
          </div>
        </form>
        <dl className="manual-page-labels">
          <div>
            <dt>PDF page index</dt>
            <dd>{page}</dd>
          </div>
          <div>
            <dt>Printed page label</dt>
            <dd>{printedPageLabel ?? "Not available"}</dd>
          </div>
        </dl>
      </div>

      <div className="manual-viewer-surface">
        {hasInvalidPageTarget ? (
          <div className="manual-viewer-state" role="alert">
            <p className="eyebrow">Invalid citation target</p>
            <h3>That PDF page is outside this manual.</h3>
            <p>
              The requested PDF page is {initialPageTarget}, but this document contains {manual.pageCount} pages. No blank viewer was opened.
            </p>
            <a className="button button-primary" href="/manual?page=1">Open first PDF page</a>
          </div>
        ) : viewerState === "unavailable" ? (
          <div className="manual-viewer-state" role="alert">
            <p className="eyebrow">Native viewer unavailable</p>
            <h3>The browser could not render the embedded PDF.</h3>
            <p>
              The original document is still available through the private server route. Open it in a new tab or try the embedded viewer again.
            </p>
            <div className="manual-viewer-state-actions">
              <a className="button button-primary" href={fileUrl} target="_blank" rel="noreferrer">
                Open original PDF
              </a>
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  setViewerState("checking");
                  setViewerAttempt((attempt) => attempt + 1);
                }}
              >
                Try embedded viewer again
              </button>
            </div>
          </div>
        ) : (
          <>
            {viewerState === "checking" || viewerState === "loading" ? (
              <p className="manual-viewer-loading" aria-live="polite">Loading the browser-native PDF surface…</p>
            ) : null}
            {viewerState !== "checking" ? (
              <iframe
                key={fileUrl}
                className="manual-pdf-frame"
                src={fileUrl}
                title={`GS750 service manual, PDF page ${page}`}
                onLoad={() => setViewerState("loaded")}
                onError={() => setViewerState("unavailable")}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
