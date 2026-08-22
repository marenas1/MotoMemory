import type { MaintenanceOutlookItem } from "@/lib/domain/types";

function formatMiles(value: number | null): string {
  return value === null ? "Unknown" : `${value.toLocaleString()} mi`;
}

function formatSource(value: string | null): string {
  if (!value) return "Not specified";
  return value.replaceAll("_", " ");
}

function formatStatus(value: MaintenanceOutlookItem["status"]): string {
  if (value === "due") return "Due now";
  if (value === "upcoming") return "Upcoming";
  return "Unknown";
}

export function MaintenanceOutlook({
  items,
}: {
  items: MaintenanceOutlookItem[];
}) {
  const nextItem = items[0];

  return (
    <section className="maintenance-panel panel" id="maintenance-overview" aria-labelledby="maintenance-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Maintenance outlook</p>
          <h2 id="maintenance-heading">What to think about next</h2>
        </div>
        <span className="panel-icon" aria-hidden="true">⚒</span>
      </div>

      {!nextItem ? (
        <p className="empty-state">No active maintenance schedule is configured.</p>
      ) : (
        <>
          <article className="next-maintenance-card">
            <div className="maintenance-card-topline">
              <div>
                <p className="card-kicker">Next maintenance</p>
                <h3>{nextItem.name}</h3>
              </div>
              <span className={`status-pill status-${nextItem.status}`}>
                {formatStatus(nextItem.status)}
              </span>
            </div>
            <p className="maintenance-source">
              Every {formatMiles(nextItem.intervalMiles)} <span aria-hidden="true">·</span> Source: {formatSource(nextItem.source)}
            </p>
            <div className="maintenance-targets">
              <div>
                <span>Next target</span>
                <strong>{formatMiles(nextItem.dueMileage)}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{formatMiles(nextItem.remainingMiles)}</strong>
              </div>
            </div>
            {nextItem.source === "phase1_configured" ? (
              <p className="provisional-note">
                Provisional schedule — replace with the service manual in Phase 2.
              </p>
            ) : null}
          </article>

          <div className="reminders-heading">
            <p className="eyebrow">Upcoming reminders</p>
            <span>{items.length} configured</span>
          </div>
          <div className="reminder-list">
            {items.map((item) => (
              <article className="reminder-item" key={item.definitionId}>
                <div>
                  <strong>{formatMiles(item.dueMileage)}</strong>
                  <span>{formatMiles(item.remainingMiles)} remaining</span>
                </div>
                <p>{item.name}</p>
                <span className={`status-pill status-${item.status}`}>{formatStatus(item.status)}</span>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
