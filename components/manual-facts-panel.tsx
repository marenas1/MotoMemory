"use client";

import { useEffect, useState } from "react";

import {
  manualFactCorrectionResponseSchema,
  manualFactsResponseSchema,
} from "@/lib/manual/manual-api-schemas";
import type {
  ManualMaintenanceFactRecord,
  PublicManualDocumentRecord,
} from "@/lib/manual/manual-types";

interface ApiErrorPayload {
  error?: { code?: string; message?: string };
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as ApiErrorPayload).error;
    if (error?.message) return error.message;
  }
  return fallback;
}

function intervalLabel(fact: ManualMaintenanceFactRecord): string {
  return `${fact.intervalValue.toLocaleString()} ${fact.intervalUnit}`;
}

function sourceLabel(fact: ManualMaintenanceFactRecord): string {
  const printed = fact.sourcePrintedPageLabel
    ? ` · printed ${fact.sourcePrintedPageLabel}`
    : "";
  return `PDF page ${fact.sourcePageStart}${printed}`;
}

function FactCorrectionForm({
  fact,
  onCancel,
  onSaved,
}: {
  fact: ManualMaintenanceFactRecord;
  onCancel: () => void;
  onSaved: (fact: ManualMaintenanceFactRecord) => void;
}) {
  const [name, setName] = useState(fact.name);
  const [intervalValue, setIntervalValue] = useState(String(fact.intervalValue));
  const [intervalUnit, setIntervalUnit] = useState(fact.intervalUnit);
  const [notes, setNotes] = useState(fact.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsedInterval = Number(intervalValue);
    if (!Number.isFinite(parsedInterval) || parsedInterval <= 0) {
      setError("Enter an interval greater than zero.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/manual/facts/${fact.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          intervalValue: parsedInterval,
          intervalUnit,
          notes: notes.trim() || null,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, "The maintenance fact could not be corrected."));
      }

      const parsedResponse = manualFactCorrectionResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        throw new Error("The correction response was invalid.");
      }

      onSaved(parsedResponse.data.fact);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The maintenance fact could not be corrected.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="manual-fact-correction" onSubmit={submit}>
      <label>
        Task
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} />
      </label>
      <div className="manual-fact-correction-row">
        <label>
          Interval
          <input
            type="number"
            min="0.01"
            step="any"
            value={intervalValue}
            onChange={(event) => setIntervalValue(event.target.value)}
          />
        </label>
        <label>
          Unit
          <select value={intervalUnit} onChange={(event) => setIntervalUnit(event.target.value as "mi" | "km")}>
            <option value="mi">mi</option>
            <option value="km">km</option>
          </select>
        </label>
      </div>
      <label>
        Note
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} />
      </label>
      {error ? <p className="state-feedback state-feedback-error" role="alert">{error}</p> : null}
      <div className="manual-fact-actions">
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save correction"}
        </button>
        <button className="button button-outline" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ManualFactsPanel({
  manual,
  readOnly = true,
}: {
  manual: PublicManualDocumentRecord;
  readOnly?: boolean;
}) {
  const [facts, setFacts] = useState<ManualMaintenanceFactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [factsExpanded, setFactsExpanded] = useState(false);

  useEffect(() => {
    if (manual.status !== "ready") return undefined;
    let cancelled = false;

    async function loadFacts() {
      try {
        const response = await fetch("/api/manual/facts", { cache: "no-store" });
        const payload: unknown = await response.json();
        if (!response.ok) {
          throw new Error(apiErrorMessage(payload, "Maintenance facts could not be loaded."));
        }
        const parsed = manualFactsResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("The maintenance fact response was invalid.");
        }
        if (!cancelled) {
          setFacts(parsed.data.facts);
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Maintenance facts could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadFacts();
    return () => {
      cancelled = true;
    };
  }, [manual.status]);

  function saveFact(fact: ManualMaintenanceFactRecord) {
    setFacts((current) => current.map((item) => (item.id === fact.id ? fact : item)));
    setEditingId(null);
    setMessage("Fact corrected. The dashboard outlook was recalculated; refresh Dashboard to see it there.");
  }

  if (manual.status !== "ready") {
    return (
      <section className="manual-facts-card panel" aria-labelledby="manual-facts-heading">
        <p className="eyebrow">Maintenance facts</p>
        <h2 id="manual-facts-heading">Facts unlock after OCR</h2>
        <p className="muted-copy">The original PDF remains available. Manual-derived facts appear after processing completes.</p>
      </section>
    );
  }

  return (
    <section className="manual-facts-card panel" aria-labelledby="manual-facts-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Maintenance facts</p>
          <h2 id="manual-facts-heading">Manual-derived intervals</h2>
        </div>
        <div className="manual-facts-heading-actions">
          <span className="scope-label">Trusted by default</span>
          <button
            className="manual-collapse-button"
            type="button"
            aria-controls="manual-facts-content"
            aria-expanded={factsExpanded}
            onClick={() => setFactsExpanded((expanded) => !expanded)}
          >
            {factsExpanded ? "Collapse" : `Show ${facts.length || "facts"}`}
          </button>
        </div>
      </div>
      <div id="manual-facts-content" hidden={!factsExpanded}>
        <p className="muted-copy">
          Facts are active immediately. Use the source link and raw OCR context to double-check an ambiguous value.
          {readOnly ? " Corrections are available from the private local owner application." : " Correct facts directly when needed."}
        </p>
        {loading ? <p className="muted-copy" role="status">Loading extracted facts…</p> : null}
        {error ? <p className="state-feedback state-feedback-error" role="alert">{error}</p> : null}
        {message ? <p className="state-feedback state-feedback-success" role="status">{message}</p> : null}
        {!loading && !error && facts.length === 0 ? (
          <p className="muted-copy">No usable task-and-interval facts were extracted. The provisional dashboard cadence remains active.</p>
        ) : null}
        <div className="manual-fact-list">
          {facts.map((fact) => (
            <article className="manual-fact" key={fact.id}>
              <div className="manual-fact-heading">
                <div>
                  <p className="card-kicker">{fact.origin === "rider_corrected" ? "Rider corrected" : "OCR fact"}</p>
                  <h3>{fact.name}</h3>
                </div>
                <strong>{intervalLabel(fact)}</strong>
              </div>
              <p className="manual-fact-source">
                <a href={fact.sourceHref}>Open source · {sourceLabel(fact)}</a>
              </p>
              <details>
                <summary>Raw OCR context</summary>
                <pre>{fact.rawOcrContext ?? "Not available"}</pre>
              </details>
              {fact.notes ? <p className="manual-fact-note">Note: {fact.notes}</p> : null}
              {readOnly ? null : editingId === fact.id ? (
                <FactCorrectionForm
                  fact={fact}
                  onCancel={() => setEditingId(null)}
                  onSaved={saveFact}
                />
              ) : (
                <button className="button button-outline" type="button" onClick={() => { setMessage(null); setEditingId(fact.id); }}>
                  Correct fact
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
