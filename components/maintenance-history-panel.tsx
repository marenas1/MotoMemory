"use client";

import { useEffect, useState } from "react";

import { StateFeedback } from "@/components/state-feedback";
import type {
  MaintenanceDefinition,
  MaintenanceRecord,
} from "@/lib/domain/types";
import {
  maintenanceHistoryResponseSchema,
  maintenanceRecordDeleteResponseSchema,
  maintenanceRecordResponseSchema,
} from "@/lib/maintenance/maintenance-api-schemas";

type FormValues = {
  definitionId: string;
  serviceType: string;
  performedMileage: string;
  performedAt: string;
  parts: string;
  cost: string;
  notes: string;
};

type Feedback = {
  kind: "saved" | "rejected" | "failed";
  message: string;
};

type RequestFailureKind = "rejected" | "failed";

const PERFORMED_MILEAGE_TOO_HIGH =
  "Performed mileage cannot exceed the current motorcycle mileage.";

class HistoryRequestError extends Error {
  constructor(
    readonly kind: RequestFailureKind,
    message: string,
  ) {
    super(message);
    this.name = "HistoryRequestError";
  }
}

interface ApiErrorPayload {
  error?: { message?: string };
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as ApiErrorPayload).error;
    if (error?.message) return error.message;
  }
  return fallback;
}

async function fetchMaintenanceHistory(): Promise<{
  currentMileage: number;
  definitions: MaintenanceDefinition[];
  records: MaintenanceRecord[];
}> {
  const response = await fetch("/api/maintenance/records", { cache: "no-store" });
  const payload: unknown = await response.json();
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Maintenance history could not be loaded."));
  }

  const parsed = maintenanceHistoryResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("The maintenance history response was invalid.");
  }

  return parsed.data;
}

function emptyForm(definitions: MaintenanceDefinition[]): FormValues {
  const firstDefinition = definitions[0];
  return {
    definitionId: firstDefinition?.id ?? "",
    serviceType: firstDefinition?.name ?? "",
    performedMileage: "",
    performedAt: "",
    parts: "",
    cost: "",
    notes: "",
  };
}

function formFromRecord(
  record: MaintenanceRecord,
): FormValues {
  return {
    definitionId: record.definitionId ?? "",
    serviceType: record.serviceType,
    performedMileage: String(record.performedMileage),
    performedAt: record.performedAt ? record.performedAt.slice(0, 10) : "",
    parts: record.parts?.join("\n") ?? "",
    cost: record.cost === null ? "" : String(record.cost),
    notes: record.notes ?? "",
  };
}

function definitionName(
  record: MaintenanceRecord,
  definitions: MaintenanceDefinition[],
): string {
  return record.definitionId
    ? definitions.find((definition) => definition.id === record.definitionId)?.name ??
        record.serviceType
    : "Other / unlinked";
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString([], {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

function formatCost(value: number | null): string | null {
  return value === null
    ? null
    : new Intl.NumberFormat([], { style: "currency", currency: "USD" }).format(value);
}

function parseParts(value: string): string[] | null {
  const parts = value
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

function sortRecords(records: MaintenanceRecord[]): MaintenanceRecord[] {
  return [...records].sort((left, right) => {
    if (left.performedMileage !== right.performedMileage) {
      return right.performedMileage - left.performedMileage;
    }

    if (left.performedAt !== right.performedAt) {
      if (!left.performedAt) return 1;
      if (!right.performedAt) return -1;
      return right.performedAt.localeCompare(left.performedAt);
    }

    if (left.createdAt !== right.createdAt) {
      return right.createdAt.localeCompare(left.createdAt);
    }

    return right.id.localeCompare(left.id);
  });
}

function validateForm(
  form: FormValues,
  currentMileage: number,
): { input: Record<string, unknown> } | { error: string } {
  if (!form.performedMileage.trim()) {
    return { error: "Performed mileage is required." };
  }

  const performedMileage = Number(form.performedMileage);
  if (!Number.isFinite(performedMileage) || performedMileage < 0) {
    return { error: "Performed mileage must be zero or greater." };
  }

  if (performedMileage > currentMileage) {
    return { error: PERFORMED_MILEAGE_TOO_HIGH };
  }

  const cost = form.cost.trim() ? Number(form.cost) : null;
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
    return { error: "Cost must be zero or greater when provided." };
  }

  return {
    input: {
      definitionId: form.definitionId || null,
      serviceType: form.serviceType,
      performedMileage,
      performedAt: form.performedAt || null,
      parts: parseParts(form.parts),
      cost,
      notes: form.notes.trim() || null,
    },
  };
}

async function requestFailure(
  response: Response,
  fallback: string,
): Promise<never> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  throw new HistoryRequestError(
    response.status >= 400 && response.status < 500 ? "rejected" : "failed",
    apiErrorMessage(payload, fallback),
  );
}

export function MaintenanceHistoryForm({
  definitions,
  currentMileage,
  initialValues,
  submitLabel,
  busy,
  onCancel,
  onRejected,
  onSubmit,
}: {
  definitions: MaintenanceDefinition[];
  currentMileage: number;
  initialValues: FormValues;
  submitLabel: string;
  busy: boolean;
  onCancel?: () => void;
  onRejected?: (message: string) => void;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState(initialValues);

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateForm(form, currentMileage);
    if ("error" in result) {
      onRejected?.(result.error);
      return;
    }
    await onSubmit(result.input);
  }

  return (
    <form
      className="maintenance-record-form"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <div className="maintenance-record-form-grid">
        <label>
          Maintenance item
          <select
            value={form.definitionId}
            onChange={(event) => {
              const definition = definitions.find((item) => item.id === event.target.value);
              updateField("definitionId", event.target.value);
              updateField("serviceType", definition?.name ?? "");
            }}
            disabled={busy}
          >
            {definitions.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.name}
              </option>
            ))}
            <option value="">Other / unlinked</option>
          </select>
        </label>

        {form.definitionId === "" ? (
          <label>
            Service description
            <input
              value={form.serviceType}
              onChange={(event) => updateField("serviceType", event.target.value)}
              maxLength={200}
              disabled={busy}
              required
            />
          </label>
        ) : null}

        <label>
          Performed mileage
          <div className="maintenance-record-input-with-unit">
            <input
              type="number"
              min="0"
              max={currentMileage}
              step="0.01"
              inputMode="decimal"
              value={form.performedMileage}
              onChange={(event) => updateField("performedMileage", event.target.value)}
              disabled={busy}
              required
            />
            <span aria-hidden="true">mi</span>
          </div>
          <span className="field-help">At or below current mileage ({currentMileage.toLocaleString()} mi).</span>
        </label>

        <label>
          Service date <span className="optional-label">optional</span>
          <input
            type="date"
            value={form.performedAt}
            onChange={(event) => updateField("performedAt", event.target.value)}
            disabled={busy}
          />
        </label>

        <label>
          Cost <span className="optional-label">optional</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.cost}
            onChange={(event) => updateField("cost", event.target.value)}
            disabled={busy}
          />
        </label>

        <label>
          Parts <span className="optional-label">optional · one per line</span>
          <textarea
            rows={3}
            value={form.parts}
            onChange={(event) => updateField("parts", event.target.value)}
            disabled={busy}
          />
        </label>

        <label className="maintenance-record-notes-field">
          Notes <span className="optional-label">optional</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            maxLength={2000}
            disabled={busy}
          />
        </label>
      </div>

      <div className="maintenance-record-form-actions">
        <button
          className="button button-primary"
          type="submit"
          disabled={busy}
          onClick={() => {
            const performedMileage = Number(form.performedMileage);
            if (Number.isFinite(performedMileage) && performedMileage > currentMileage) {
              onRejected?.(PERFORMED_MILEAGE_TOO_HIGH);
            }
          }}
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button className="button button-outline" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function MaintenanceHistoryPanel({
  currentMileage,
  onHistoryChanged,
}: {
  currentMileage: number;
  onHistoryChanged?: () => Promise<void>;
}) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [definitions, setDefinitions] = useState<MaintenanceDefinition[]>([]);
  const [form, setForm] = useState<FormValues>(() => emptyForm([]));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  function applyHistory(data: {
    definitions: MaintenanceDefinition[];
    records: MaintenanceRecord[];
  }) {
    setRecords(sortRecords(data.records));
    setDefinitions(data.definitions);
    setForm(emptyForm(data.definitions));
    setFormRevision((revision) => revision + 1);
  }

  async function loadHistory() {
    setLoading(true);
    try {
      applyHistory(await fetchMaintenanceHistory());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Maintenance history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function requestHistory() {
      try {
        const data = await fetchMaintenanceHistory();
        if (!cancelled) {
          applyHistory(data);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Maintenance history could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void requestHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveRecord(input: Record<string, unknown>) {
    setBusy(true);
    setFeedback(null);

    try {
      const response = await fetch(
        editingId
          ? `/api/maintenance/records/${editingId}`
          : "/api/maintenance/records",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const payload: unknown = await response.json();
      if (!response.ok) {
        await requestFailure(
          new Response(JSON.stringify(payload), { status: response.status }),
          editingId ? "The maintenance record could not be updated." : "The maintenance record could not be saved.",
        );
      }

      const parsed = maintenanceRecordResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new HistoryRequestError("failed", "The saved maintenance record response was invalid.");
      }

      const record = parsed.data.record;
      setRecords((current) =>
        sortRecords(
          editingId
            ? current.map((item) => (item.id === record.id ? record : item))
            : [record, ...current],
        ),
      );
      setFeedback({
        kind: "saved",
        message: editingId ? "Maintenance record updated." : "Maintenance record saved.",
      });
      let refreshError: string | null = null;
      try {
        await onHistoryChanged?.();
      } catch (error) {
        refreshError = error instanceof Error ? error.message : "The outlook could not be refreshed.";
      }
      if (refreshError) {
        setFeedback({
          kind: "failed",
          message: `Record saved, but the outlook could not be refreshed: ${refreshError}`,
        });
      }
      setEditingId(null);
      setForm(emptyForm(definitions));
      setFormRevision((revision) => revision + 1);
    } catch (error) {
      const kind = error instanceof HistoryRequestError ? error.kind : "failed";
      setFeedback({
        kind,
        message:
          error instanceof Error
            ? `${kind === "rejected" ? "Record rejected" : "Record failed"}: ${error.message}`
            : "Record failed: The maintenance record could not be saved.",
      });
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(record: MaintenanceRecord) {
    setEditingId(record.id);
    setForm(formFromRecord(record));
    setFormRevision((revision) => revision + 1);
    setFeedback(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm(definitions));
    setFormRevision((revision) => revision + 1);
    setFeedback(null);
  }

  async function deleteRecord(recordId: string) {
    if (!window.confirm("Delete this maintenance record? This does not change manual facts.")) {
      return;
    }

    setBusyRecordId(recordId);
    setFeedback(null);
    try {
      const response = await fetch(`/api/maintenance/records/${recordId}`, {
        method: "DELETE",
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        await requestFailure(
          new Response(JSON.stringify(payload), { status: response.status }),
          "The maintenance record could not be deleted.",
        );
      }

      const parsed = maintenanceRecordDeleteResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new HistoryRequestError("failed", "The delete response was invalid.");
      }

      setRecords((current) => current.filter((record) => record.id !== parsed.data.deletedId));
      if (editingId === recordId) {
        cancelEdit();
      }
      let refreshError: string | null = null;
      try {
        await onHistoryChanged?.();
      } catch (error) {
        refreshError = error instanceof Error ? error.message : "The outlook could not be refreshed.";
      }
      setFeedback(
        refreshError
          ? {
              kind: "failed",
              message: `Record deleted, but the outlook could not be refreshed: ${refreshError}`,
            }
          : { kind: "saved", message: "Maintenance record deleted." },
      );
    } catch (error) {
      const kind = error instanceof HistoryRequestError ? error.kind : "failed";
      setFeedback({
        kind,
        message:
          error instanceof Error
            ? `${kind === "rejected" ? "Delete rejected" : "Delete failed"}: ${error.message}`
            : "Delete failed: The maintenance record could not be deleted.",
      });
    } finally {
      setBusyRecordId(null);
    }
  }

  return (
    <section className="maintenance-history-panel panel" id="maintenance-history" aria-labelledby="maintenance-history-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Service history</p>
          <h2 id="maintenance-history-heading">Record completed work</h2>
        </div>
        <span className="panel-icon" aria-hidden="true">↺</span>
      </div>
      <p className="maintenance-history-intro">
        Add one maintenance item at a time. Mileage is checked against the current odometer; optional details stay with the event.
      </p>

      {loading ? <p className="muted-copy" role="status">Loading service history…</p> : null}
      {!loading && loadError ? (
        <div className="maintenance-history-unavailable" role="alert">
          <p>{loadError}</p>
          <button className="button button-outline" type="button" onClick={() => void loadHistory()}>
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !loadError ? (
        <>
          <div className="maintenance-history-form-card">
            <div className="maintenance-history-subheading">
              <div>
                <p className="card-kicker">{editingId ? "Correct a record" : "New record"}</p>
                <h3>{editingId ? "Edit completed work" : "What did you service?"}</h3>
              </div>
              <span className="scope-label">One item</span>
            </div>
            <MaintenanceHistoryForm
              key={`${editingId ?? "new"}-${formRevision}`}
              definitions={definitions}
              currentMileage={currentMileage}
              initialValues={form}
              submitLabel={editingId ? "Save changes" : "Save record"}
              busy={busy}
              onCancel={editingId ? cancelEdit : undefined}
              onRejected={(message) => setFeedback({ kind: "rejected", message: `Record rejected: ${message}` })}
              onSubmit={saveRecord}
            />
          </div>

          {feedback ? (
            <StateFeedback variant={feedback.kind === "saved" ? "success" : "error"}>
              {feedback.message}
            </StateFeedback>
          ) : null}

          <div className="maintenance-history-list" aria-live="polite">
            <div className="maintenance-history-list-heading">
              <p className="eyebrow">Recorded events</p>
              <span>{records.length} {records.length === 1 ? "event" : "events"}</span>
            </div>
            {records.length === 0 ? (
              <p className="empty-state">No service records yet. Your first saved event will appear here after confirmation.</p>
            ) : (
              records.map((record) => {
                const date = formatDate(record.performedAt);
                const cost = formatCost(record.cost);
                return (
                  <article
                    className="maintenance-history-record"
                    id={`maintenance-record-${record.id}`}
                    key={record.id}
                  >
                    <div className="maintenance-history-record-heading">
                      <div>
                        <p className="card-kicker">{record.definitionId ? "Selected maintenance item" : "Other / unlinked"}</p>
                        <h3>{definitionName(record, definitions)}</h3>
                      </div>
                      <strong>{record.performedMileage.toLocaleString()} mi</strong>
                    </div>
                    <dl className="maintenance-history-metadata">
                      {date ? <div><dt>Service date</dt><dd><time dateTime={record.performedAt ?? undefined}>{date}</time></dd></div> : null}
                      {cost ? <div><dt>Cost</dt><dd>{cost}</dd></div> : null}
                      {record.parts?.length ? <div><dt>Parts</dt><dd>{record.parts.join(" · ")}</dd></div> : null}
                    </dl>
                    {record.notes ? <p className="maintenance-history-notes">{record.notes}</p> : null}
                    <div className="maintenance-history-record-actions">
                      <button className="button button-outline" type="button" onClick={() => beginEdit(record)} disabled={busy || busyRecordId !== null}>
                        Edit
                      </button>
                      <button className="button button-danger" type="button" onClick={() => void deleteRecord(record.id)} disabled={busy || busyRecordId !== null}>
                        {busyRecordId === record.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
