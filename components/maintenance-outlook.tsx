import Link from "next/link";

import type { MaintenanceOutlookItem } from "@/lib/domain/types";

function formatMiles(value: number | null, unavailable = "Unknown"): string {
  return value === null ? unavailable : `${value.toLocaleString()} mi`;
}

function formatSource(value: string | null): string {
  if (!value) return "Not specified";
  return value.replaceAll("_", " ");
}

function formatInterval(item: MaintenanceOutlookItem): string {
  const value = item.intervalValue ?? item.intervalMiles;
  const unit = item.intervalUnit ?? "mi";
  if (value === null) return "Unknown";

  const interval = `${value.toLocaleString()} ${unit}`;
  if (unit === "km" && item.intervalMiles !== null) {
    return `${interval} (${item.intervalMiles.toLocaleString()} mi for target)`;
  }

  return interval;
}

function formatStatus(value: MaintenanceOutlookItem["status"]): string {
  if (value === "not_recorded") return "Not recorded";
  if (value === "due") return "Due now";
  if (value === "upcoming") return "Upcoming";
  if (value === "overdue") return "Overdue";
  return "Unknown";
}

function sourcePageLabel(item: MaintenanceOutlookItem): string | null {
  if (item.sourcePageStart === null || item.sourcePageStart === undefined) {
    return null;
  }

  const pageRange =
    item.sourcePageEnd && item.sourcePageEnd !== item.sourcePageStart
      ? `${item.sourcePageStart}–${item.sourcePageEnd}`
      : String(item.sourcePageStart);
  const printedPage = item.sourcePrintedPageLabel
    ? ` · printed ${item.sourcePrintedPageLabel}`
    : "";
  return `PDF page ${pageRange}${printedPage}`;
}

function lastServiceLabel(item: MaintenanceOutlookItem): string {
  if (item.status === "not_recorded") return "Not recorded";
  return formatMiles(item.lastServiceMileage, "Unavailable");
}

function targetLabel(item: MaintenanceOutlookItem): string {
  return item.status === "unknown"
    ? "Unavailable"
    : formatMiles(item.dueMileage, "Unavailable");
}

function remainingLabel(item: MaintenanceOutlookItem): string {
  return item.status === "unknown"
    ? "Unavailable"
    : formatMiles(item.remainingMiles, "Unavailable");
}

function serviceRecordHref(item: MaintenanceOutlookItem): string | null {
  return item.lastServiceRecordId
    ? `/history#maintenance-record-${item.lastServiceRecordId}`
    : null;
}

function MaintenanceOutlookCard({
  item,
  isFirst,
}: {
  item: MaintenanceOutlookItem;
  isFirst: boolean;
}) {
  const hasHistory = item.lastServiceRecordId !== null;
  const sourcePage = sourcePageLabel(item);
  const serviceRecord = serviceRecordHref(item);

  return (
    <article
      className={`maintenance-outlook-card ${isFirst ? "next-maintenance-card" : "reminder-item"}`}
      id={`maintenance-outlook-${item.definitionId}`}
    >
      <div className="maintenance-card-topline">
        <div>
          <p className="card-kicker">{isFirst ? "Next maintenance" : "Maintenance item"}</p>
          <h3>{item.name}</h3>
        </div>
        <span className={`status-pill status-${item.status}`}>
          {formatStatus(item.status)}
        </span>
      </div>

      <p className="maintenance-source">
        Source: {formatSource(item.source)}
        {sourcePage ? <> <span aria-hidden="true">·</span> {sourcePage}</> : null}
        {item.sourceHref ? (
          <>
            <span aria-hidden="true">·</span>{" "}
            <Link href={item.sourceHref}>Open manual source</Link>
          </>
        ) : null}
      </p>

      <dl className="maintenance-explanation">
        <div>
          <dt>Current mileage</dt>
          <dd>{formatMiles(item.currentMileage)}</dd>
        </div>
        <div>
          <dt>Interval</dt>
          <dd>{formatInterval(item)}</dd>
        </div>
        <div>
          <dt>Last service mileage</dt>
          <dd>{lastServiceLabel(item)}</dd>
        </div>
        {hasHistory ? (
          <>
            <div>
              <dt>Next target</dt>
              <dd>{targetLabel(item)}</dd>
            </div>
            <div>
              <dt>Remaining distance</dt>
              <dd>{remainingLabel(item)}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <div className="maintenance-outlook-links">
        {serviceRecord ? <a href={serviceRecord}>View service record</a> : null}
        {item.status === "not_recorded" ? (
          <a href="/history#maintenance-history">Add completed service</a>
        ) : null}
      </div>

      {item.rawOcrContext ? (
        <details className="maintenance-evidence">
          <summary>Show raw manual evidence</summary>
          <pre>{item.rawOcrContext}</pre>
        </details>
      ) : null}

      {item.status === "not_recorded" ? (
        <p className="provisional-note">
          Record the completed service to calculate a personalized target.
        </p>
      ) : null}
      {item.status === "unknown" ? (
        <p className="provisional-note">
          Correct the mileage, interval, or service history inputs to calculate a target.
        </p>
      ) : null}
      {item.source === "phase1_configured" ? (
        <p className="provisional-note">
          Provisional schedule — replace with the service manual in Phase 2.
        </p>
      ) : null}
    </article>
  );
}

export function MaintenanceOutlook({
  items,
}: {
  items: MaintenanceOutlookItem[];
}) {
  return (
    <section
      className="maintenance-panel panel"
      id="maintenance-overview"
      aria-labelledby="maintenance-heading"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Maintenance outlook</p>
          <h2 id="maintenance-heading">What to think about next</h2>
        </div>
        <span className="panel-icon" aria-hidden="true">⚒</span>
      </div>

      {!items.length ? (
        <p className="empty-state">No active maintenance schedule is configured.</p>
      ) : (
        <>
          <div className="reminders-heading">
            <p className="eyebrow">Schedule details</p>
            <span>{items.length} configured</span>
          </div>
          <div className="reminder-list maintenance-outlook-list">
            {items.map((item, index) => (
              <MaintenanceOutlookCard
                key={item.definitionId}
                item={item}
                isFirst={index === 0}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
