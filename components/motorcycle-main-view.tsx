"use client";

import { useState } from "react";

import { MaintenanceOutlook } from "@/components/maintenance-outlook";
import { MaintenanceHistoryPanel } from "@/components/maintenance-history-panel";
import { MileageForm } from "@/components/mileage-form";
import { MotorcycleNavigation } from "@/components/motorcycle-navigation";
import { StateFeedback } from "@/components/state-feedback";
import type { MotorcycleOverview } from "@/lib/domain/types";

type SaveState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Seeded Phase 1 state";
  }

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function MotorcycleMainView({
  initialOverview,
}: {
  initialOverview: MotorcycleOverview;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  async function saveMileage(mileage: string) {
    setSaveState({ status: "pending" });

    try {
      const response = await fetch("/api/motorcycle/mileage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mileage,
          expectedCurrentMileage: overview.motorcycle.currentMileage,
        }),
      });
      const payload: MotorcycleOverview | ApiError = await response.json();

      if (!response.ok) {
        const message =
          "error" in payload && payload.error?.message
            ? payload.error.message
            : "The mileage update could not be saved.";
        setSaveState({ status: "error", message });
        return;
      }

      setOverview(payload as MotorcycleOverview);
      setSaveState({ status: "success", message: "Mileage saved." });
    } catch {
      setSaveState({
        status: "error",
        message: "The app could not reach the mileage service.",
      });
    }
  }

  async function refreshOverviewAfterHistoryChange() {
    const response = await fetch("/api/motorcycle", { cache: "no-store" });
    const payload: MotorcycleOverview | ApiError = await response.json();
    if (!response.ok) {
      const message =
        "error" in payload && payload.error?.message
          ? payload.error.message
          : "The maintenance outlook could not be refreshed.";
      throw new Error(message);
    }

    setOverview(payload as MotorcycleOverview);
  }

  const { motorcycle } = overview;

  return (
    <main className="dashboard-shell" id="dashboard">
      <MotorcycleNavigation active="dashboard" />

      <div className="dashboard-content">
        <div className="dashboard-stage">
          <header className="topbar">
            <div>
              <p className="eyebrow">MotoMemory dashboard</p>
              <h1>Welcome back.</h1>
              <p className="topbar-subtitle">Here&apos;s your bike at a glance.</p>
            </div>
            <span className="scope-label">Personal <b aria-hidden="true">·</b> one motorcycle</span>
          </header>

          <section className="hero-grid" aria-labelledby="motorcycle-name">
            <article className="hero-panel">
              <div className="hero-copy">
                <p className="eyebrow">Your motorcycle</p>
                <h2 id="motorcycle-name">
                  <span>{motorcycle.modelYear} {motorcycle.make}</span>
                  <strong>{motorcycle.model}</strong>
                </h2>
                <div className="spec-tags" aria-label="Motorcycle details">
                  <span>Personal bike</span>
                  <span>Vintage garage</span>
                </div>
              </div>

              <div className="hero-balance" aria-hidden="true" />

              <div className="hero-footer" aria-hidden="true">
                <span>Vintage</span>
                <i />
                <span>Garage</span>
              </div>
            </article>

            <section className="mileage-panel panel" aria-labelledby="current-mileage-heading">
              <div className="panel-heading compact-heading">
                <div>
                  <p className="eyebrow">Current mileage</p>
                  <h2 id="current-mileage-heading">{motorcycle.currentMileage.toLocaleString()}</h2>
                </div>
                <span className="mileage-unit">{motorcycle.mileageUnit}</span>
              </div>
              <div className="mileage-rule" aria-hidden="true"><span /></div>
              <dl className="mileage-meta">
                <div>
                  <dt>Last updated</dt>
                  <dd>{formatTimestamp(motorcycle.lastMileageUpdateAt)}</dd>
                </div>
                <div>
                  <dt>Update source</dt>
                  <dd>{motorcycle.lastMileageUpdateOrigin ?? "Seeded state"}</dd>
                </div>
              </dl>
              <button className="text-action" type="button" onClick={() => scrollToSection("mileage-update")}>
                Set current mileage <span aria-hidden="true">→</span>
              </button>
            </section>
          </section>
        </div>

        <section className="content-grid">
          <MaintenanceOutlook items={overview.maintenanceOutlook} />

          <section className="update-panel panel" id="mileage-update" aria-labelledby="update-heading">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Manual update</p>
                <h2 id="update-heading">Set current mileage</h2>
              </div>
              <span className="panel-icon" aria-hidden="true">↗</span>
            </div>
            <MileageForm
              currentMileage={motorcycle.currentMileage}
              disabled={saveState.status === "pending"}
              onSubmit={saveMileage}
            />
            {saveState.status === "pending" ? (
              <StateFeedback variant="info">Saving mileage…</StateFeedback>
            ) : null}
            {saveState.status === "success" ? (
              <StateFeedback variant="success">{saveState.message}</StateFeedback>
            ) : null}
            {saveState.status === "error" ? (
              <StateFeedback variant="error">{saveState.message}</StateFeedback>
            ) : null}

            <div className="quick-actions" aria-labelledby="quick-actions-heading">
              <div className="quick-actions-heading">
                <p className="eyebrow" id="quick-actions-heading">Quick actions</p>
                <span className="quick-actions-note">Phase 1</span>
              </div>
              <div className="quick-actions-grid">
                <button className="action-tile" type="button" onClick={() => scrollToSection("mileage-update")}>
                  Update mileage <span aria-hidden="true">→</span>
                </button>
                <button className="action-tile" type="button" onClick={() => scrollToSection("maintenance-overview")}>
                  Review upcoming <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </section>
        </section>

        <MaintenanceHistoryPanel
          currentMileage={motorcycle.currentMileage}
          onHistoryChanged={refreshOverviewAfterHistoryChange}
        />

        <footer className="dashboard-footer">
          <span>MotoMemory © 2026</span>
          <i aria-hidden="true">•</i>
          <span>Vintage garage</span>
          <i aria-hidden="true">•</i>
          <span>Personal · one motorcycle</span>
          <strong>Gunmetal + Amber</strong>
        </footer>
      </div>
    </main>
  );
}
