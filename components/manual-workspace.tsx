"use client";

import { useCallback, useEffect, useState } from "react";

import { ManualPdfViewer } from "@/components/manual-pdf-viewer";
import { ManualEvidencePanel } from "@/components/manual-evidence-panel";
import { ManualFactsPanel } from "@/components/manual-facts-panel";
import type {
  ManualIngestionProgress,
  PublicManualDocumentRecord,
} from "@/lib/manual/manual-types";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type WorkspaceLoadState = "loading" | "ready" | "unavailable";
type WorkspaceAction = "idle" | "uploading" | "processing";

interface ManualApiPayload {
  manual?: PublicManualDocumentRecord | null;
  progress?: ManualIngestionProgress | null;
  started?: boolean;
  error?: { message?: string };
}

function errorMessage(payload: ManualApiPayload, fallback: string): string {
  return payload.error?.message ?? fallback;
}

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTitle(status: PublicManualDocumentRecord["status"]): string {
  switch (status) {
    case "uploaded":
      return "Uploaded; OCR has not started";
    case "processing":
      return "OCR is processing this manual";
    case "ready":
      return "Manual processing is complete";
    case "failed":
      return "OCR processing failed";
  }
}

async function fetchManualStatus(): Promise<ManualApiPayload> {
  const response = await fetch("/api/manual", { cache: "no-store" });
  const payload = (await response.json()) as ManualApiPayload;
  if (!response.ok) {
    throw new Error(errorMessage(payload, "The manual status could not be loaded."));
  }

  return payload;
}

export function ManualWorkspace({
  initialPageTarget,
  initialPrintedPageLabel,
}: {
  initialPageTarget: number | null;
  initialPrintedPageLabel: string | null;
}) {
  const [manual, setManual] = useState<PublicManualDocumentRecord | null>(null);
  const [progress, setProgress] = useState<ManualIngestionProgress | null>(null);
  const [loadState, setLoadState] = useState<WorkspaceLoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [action, setAction] = useState<WorkspaceAction>("idle");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadManual = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadState("loading");
    }

    try {
      const response = await fetch("/api/manual", { cache: "no-store" });
      const payload = (await response.json()) as ManualApiPayload;
      if (!response.ok) {
        throw new Error(errorMessage(payload, "The manual status could not be loaded."));
      }

      setManual(payload.manual ?? null);
      setProgress(payload.progress ?? null);
      setLoadError(null);
      setLoadState("ready");
    } catch (error) {
      setLoadState("unavailable");
      setLoadError(error instanceof Error ? error.message : "The manual service is unavailable right now.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function requestInitialStatus() {
      try {
        const payload = await fetchManualStatus();
        if (cancelled) {
          return;
        }
        setManual(payload.manual ?? null);
        setProgress(payload.progress ?? null);
        setLoadError(null);
        setLoadState("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadState("unavailable");
        setLoadError(error instanceof Error ? error.message : "The manual service is unavailable right now.");
      }
    }

    void requestInitialStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (manual?.status !== "processing") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void loadManual(true);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadManual, manual?.status]);

  async function startProcessing() {
    setAction("processing");
    setActionMessage(null);
    setActionError(null);

    try {
      const response = await fetch("/api/manual/ingest", { method: "POST" });
      const payload = (await response.json()) as ManualApiPayload;
      if (!response.ok || !payload.manual) {
        throw new Error(errorMessage(payload, "Manual processing could not be started."));
      }

      setManual(payload.manual);
      setProgress(payload.progress ?? null);
      setActionMessage(
        payload.started === false
          ? "The manual is already processing or ready."
          : "OCR started. Progress will update automatically.",
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Manual processing could not be started.");
    } finally {
      setAction("idle");
    }
  }

  async function uploadManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setActionError("Choose the manual PDF before uploading.");
      return;
    }

    setAction("uploading");
    setActionMessage(null);
    setActionError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch("/api/manual", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ManualApiPayload;
      if (!response.ok || !payload.manual) {
        throw new Error(errorMessage(payload, "The manual could not be uploaded."));
      }

      setManual(payload.manual);
      setSelectedFile(null);
      setActionMessage("Manual uploaded. Starting processing…");

      const ingestionResponse = await fetch("/api/manual/ingest", { method: "POST" });
      const ingestionPayload = (await ingestionResponse.json()) as ManualApiPayload;
      if (!ingestionResponse.ok || !ingestionPayload.manual) {
        setActionError(errorMessage(ingestionPayload, "The manual uploaded, but processing could not be started."));
        return;
      }

      setManual(ingestionPayload.manual);
      setProgress(ingestionPayload.progress ?? null);
      setActionMessage(
        ingestionPayload.started === false
          ? "Manual uploaded. It is already processing or ready."
          : "Manual uploaded and OCR started. Progress will update automatically.",
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The manual could not be uploaded.");
    } finally {
      setAction("idle");
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setActionError(null);

    if (file && (file.type !== "application/pdf" || file.size > MAX_FILE_SIZE_BYTES)) {
      setActionError(
        file.type !== "application/pdf"
          ? "Choose a PDF file."
          : "Manual files must be no larger than 25 MB.",
      );
    }
  }

  if (loadState === "loading") {
    return (
      <section className="manual-state-card panel" aria-busy="true" aria-live="polite">
        <p className="eyebrow">Manual status</p>
        <h2>Checking for the private manual…</h2>
        <p className="muted-copy">The original document is kept behind the server-side route.</p>
      </section>
    );
  }

  if (loadState === "unavailable") {
    return (
      <section className="manual-state-card panel" role="alert">
        <p className="eyebrow">Manual status unavailable</p>
        <h2>The private manual service could not be reached.</h2>
        <p className="muted-copy">{loadError}</p>
        <button className="button button-outline" type="button" onClick={() => void loadManual()}>
          Try again
        </button>
      </section>
    );
  }

  if (!manual) {
    return (
      <section className="manual-upload-layout">
        <section className="manual-state-card panel" aria-labelledby="manual-missing-heading">
          <p className="eyebrow">No source uploaded</p>
          <h2 id="manual-missing-heading">Upload the GS750 service manual</h2>
          <p className="muted-copy">
            This phase accepts one private PDF. The current starting limit is 25 MB and 100 pages; the selected manual is expected to be 67 pages.
          </p>
          <form className="manual-upload-form" onSubmit={uploadManual}>
            <label htmlFor="manual-upload">Manual PDF</label>
            <input
              id="manual-upload"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              disabled={action !== "idle"}
            />
            <p className="field-help">PDF only · up to 25 MB · one document for this motorcycle</p>
            {selectedFile ? <p className="selected-file">Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})</p> : null}
            {actionError ? <p className="state-feedback state-feedback-error" role="alert">{actionError}</p> : null}
            <button className="button button-primary" type="submit" disabled={action !== "idle" || !selectedFile}>
              {action === "uploading" ? "Uploading…" : "Upload manual"}
            </button>
          </form>
        </section>
      </section>
    );
  }

  const isProcessingAction = action === "processing";

  return (
    <div className="manual-workspace">
      <section className="manual-status-card panel" aria-labelledby="manual-status-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Current manual</p>
            <h2 id="manual-status-heading">{manual.fileName}</h2>
          </div>
          <span className={`status-pill status-manual-${manual.status}`}>{manual.status}</span>
        </div>
        <dl className="manual-metadata">
          <div><dt>PDF pages</dt><dd>{manual.pageCount}</dd></div>
          <div><dt>File size</dt><dd>{formatFileSize(manual.fileSizeBytes)}</dd></div>
          <div><dt>Uploaded</dt><dd>{new Date(manual.uploadedAt).toLocaleDateString()}</dd></div>
          {progress ? (
            <div>
              <dt>OCR pages</dt>
              <dd>{progress.accountedPages}/{progress.totalPages} accounted</dd>
            </div>
          ) : null}
        </dl>
        <p className={`manual-status-message manual-status-${manual.status}`}>
          {statusTitle(manual.status)}
          {manual.status === "processing" ? " The original PDF remains available while OCR runs." : null}
          {manual.status === "failed" && manual.errorMessage ? ` ${manual.errorMessage}` : null}
        </p>
        {progress ? (
          <>
            <div className="manual-progress" aria-label="OCR progress">
              <div className="manual-progress-heading">
                <span>OCR progress</span>
                <strong>{progress.percentComplete}%</strong>
              </div>
              <progress
                className="manual-progress-bar"
                max={100}
                value={progress.percentComplete}
                aria-label={`${progress.percentComplete}% of PDF pages accounted for`}
              >
                {progress.percentComplete}%
              </progress>
              <p className="manual-progress-caption">
                {manual.status === "processing"
                  ? "Page counts refresh automatically every 5 seconds."
                  : progress.failedPages > 0
                    ? "Retry processing to retry the incomplete pages."
                    : "All PDF pages have been accounted for."}
              </p>
              <div className="manual-progress-metrics" role="status" aria-live="polite">
                <div aria-label={`${progress.accountedPages} of ${progress.totalPages} pages accounted`}>
                  <strong>{progress.accountedPages}/{progress.totalPages}</strong>
                  <span>accounted</span>
                </div>
                <div aria-label={`${progress.availablePages} searchable pages`}>
                  <strong>{progress.availablePages}</strong>
                  <span>searchable</span>
                </div>
                <div aria-label={`${progress.failedPages} failed pages`}>
                  <strong>{progress.failedPages}</strong>
                  <span>failed</span>
                </div>
                <div aria-label={`${progress.pendingPages} pending pages`}>
                  <strong>{progress.pendingPages}</strong>
                  <span>pending</span>
                </div>
              </div>
            </div>
            {progress.failures.length > 0 ? (
              <ul className="manual-failure-list" aria-label="OCR page failures">
                {progress.failures.map((failure) => (
                  <li key={failure.pageNumber}>
                    PDF page {failure.pageNumber}: {failure.errorMessage ?? "OCR failed."}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
        {manual.status !== "processing" ? (
          <button className="button button-outline" type="button" onClick={() => void startProcessing()} disabled={isProcessingAction}>
            {isProcessingAction
              ? "Starting…"
              : manual.status === "failed"
                ? "Retry processing"
                : manual.status === "ready"
                  ? "Reprocess manual"
                  : "Start processing"}
          </button>
        ) : null}
        {actionMessage ? <p className="state-feedback state-feedback-info" role="status">{actionMessage}</p> : null}
        {actionError ? <p className="state-feedback state-feedback-error" role="alert">{actionError}</p> : null}
      </section>

      <ManualFactsPanel manual={manual} />

      <ManualEvidencePanel manual={manual} />

      <ManualPdfViewer
        key={`${initialPageTarget ?? "default"}:${initialPrintedPageLabel ?? ""}`}
        manual={manual}
        initialPageTarget={initialPageTarget}
        initialPrintedPageLabel={initialPrintedPageLabel}
      />
    </div>
  );
}
