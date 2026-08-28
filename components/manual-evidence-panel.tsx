"use client";

import { useState } from "react";

import {
  manualQuestionResponseSchema,
  manualSearchResponseSchema,
  type ManualQuestionResponse,
  type ManualSearchResponse,
} from "@/lib/manual/manual-api-schemas";
import type { PublicManualDocumentRecord } from "@/lib/manual/manual-types";

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as ApiErrorPayload).error;
    if (error?.message) {
      return error.message;
    }
  }

  return fallback;
}

function pageLabel(pageStart: number, pageEnd: number): string {
  return pageStart === pageEnd
    ? `PDF page ${pageStart}`
    : `PDF pages ${pageStart}–${pageEnd}`;
}

function printedLabel(
  printedPageStart: string | null,
  printedPageEnd: string | null,
): string | null {
  if (!printedPageStart) {
    return null;
  }

  return printedPageStart === printedPageEnd || !printedPageEnd
    ? `printed page ${printedPageStart}`
    : `printed pages ${printedPageStart}–${printedPageEnd}`;
}

function PassageList({
  passages,
  heading,
}: {
  passages: ManualSearchResponse["passages"];
  heading: string;
}) {
  if (passages.length === 0) {
    return <p className="muted-copy">No matching OCR passages were found.</p>;
  }

  return (
    <div className="manual-passage-list" aria-label={heading}>
      {passages.map((passage) => (
        <article className="manual-passage" key={passage.id}>
          <div className="manual-passage-heading">
            <span>
              {pageLabel(passage.pageStart, passage.pageEnd)}
              {printedLabel(passage.printedPageStart, passage.printedPageEnd)
                ? ` · ${printedLabel(passage.printedPageStart, passage.printedPageEnd)}`
                : ""}
            </span>
            <a href={passage.citationHref}>Open source</a>
          </div>
          <p>{passage.content}</p>
        </article>
      ))}
    </div>
  );
}

export function ManualEvidencePanel({
  manual,
}: {
  manual: PublicManualDocumentRecord;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [questionInput, setQuestionInput] = useState("");
  const [searchResponse, setSearchResponse] = useState<ManualSearchResponse | null>(null);
  const [questionResponse, setQuestionResponse] = useState<ManualQuestionResponse | null>(null);
  const [busy, setBusy] = useState<"search" | "question" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function searchEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("search");
    setError(null);

    try {
      const response = await fetch("/api/manual/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: searchInput }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Manual evidence search failed."));
      }

      const parsed = manualSearchResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("The manual search response was invalid.");
      }

      setSearchResponse(parsed.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Manual evidence search failed.");
    } finally {
      setBusy(null);
    }
  }

  async function askManualQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("question");
    setError(null);

    try {
      const response = await fetch("/api/manual/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: questionInput }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "The manual question could not be processed."));
      }

      const parsed = manualQuestionResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("The manual question response was invalid.");
      }

      setQuestionResponse(parsed.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The manual question could not be processed.");
    } finally {
      setBusy(null);
    }
  }

  if (manual.status !== "ready") {
    return (
      <section className="manual-evidence-card panel" aria-labelledby="manual-evidence-heading">
        <p className="eyebrow">Manual evidence</p>
        <h2 id="manual-evidence-heading">Search and questions unlock after OCR</h2>
        <p className="muted-copy">
          The original PDF can be browsed now. Searchable passages will be available when processing reaches a complete state.
        </p>
      </section>
    );
  }

  return (
    <section className="manual-evidence-card panel" aria-labelledby="manual-evidence-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Manual evidence</p>
          <h2 id="manual-evidence-heading">Search the scanned manual</h2>
        </div>
        <span className="scope-label">OCR passages only</span>
      </div>

      <div className="manual-evidence-actions">
        <form className="manual-evidence-form" onSubmit={searchEvidence}>
          <label htmlFor="manual-search-input">Search terms</label>
          <div className="manual-evidence-form-controls">
            <input
              id="manual-search-input"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              maxLength={500}
              placeholder="e.g. valve clearance"
            />
            <button className="button button-outline" type="submit" disabled={busy !== null || !searchInput.trim()}>
              {busy === "search" ? "Searching…" : "Search"}
            </button>
          </div>
        </form>

        <form className="manual-evidence-form" onSubmit={askManualQuestion}>
          <label htmlFor="manual-question-input">Ask what the manual says</label>
          <div className="manual-evidence-form-controls">
            <input
              id="manual-question-input"
              value={questionInput}
              onChange={(event) => setQuestionInput(event.target.value)}
              maxLength={500}
              placeholder="e.g. When should I inspect the valves?"
            />
            <button className="button button-primary" type="submit" disabled={busy !== null || !questionInput.trim()}>
              {busy === "question" ? "Checking…" : "Ask"}
            </button>
          </div>
        </form>
      </div>

      {error ? <p className="state-feedback state-feedback-error" role="alert">{error}</p> : null}

      {searchResponse ? (
        <section className="manual-result-section" aria-labelledby="manual-search-results-heading">
          <h3 id="manual-search-results-heading">Search results</h3>
          <PassageList passages={searchResponse.passages} heading="Search result passages" />
        </section>
      ) : null}

      {questionResponse ? (
        <section className="manual-result-section" aria-labelledby="manual-question-result-heading">
          <h3 id="manual-question-result-heading">Question result</h3>
          {questionResponse.state === "supported_evidence" ? (
            <p className="manual-answer manual-answer-supported">{questionResponse.answer}</p>
          ) : questionResponse.state === "insufficient_evidence" ? (
            <p className="manual-answer manual-answer-insufficient">{questionResponse.answer}</p>
          ) : (
            <p className="manual-answer manual-answer-unavailable">{questionResponse.message}</p>
          )}
          {questionResponse.citations.length > 0 ? (
            <div className="manual-citation-list" aria-label="Answer citations">
              {questionResponse.citations.map((citation) => (
                <a className="manual-citation" href={citation.href} key={`${citation.passageId}:${citation.pdfPageStart}`}>
                  {pageLabel(citation.pdfPageStart, citation.pdfPageEnd)}
                  {printedLabel(citation.printedPageStart, citation.printedPageEnd)
                    ? ` · ${printedLabel(citation.printedPageStart, citation.printedPageEnd)}`
                    : ""}
                </a>
              ))}
            </div>
          ) : null}
          <PassageList passages={questionResponse.passages} heading="Question evidence passages" />
        </section>
      ) : null}
    </section>
  );
}
