import { connection } from "next/server";

import { MaintenanceHistoryPanel } from "@/components/maintenance-history-panel";
import { MotorcycleNavigation } from "@/components/motorcycle-navigation";
import { WorkspaceUnavailableState } from "@/components/workspace-unavailable-state";
import { getMotorcycleOverview } from "@/lib/data/motorcycle-repository";
import { asAppError } from "@/lib/server/errors";
import { getReadableScope } from "@/lib/server/read-access";

export default async function HistoryPage() {
  await connection();

  let canManage = false;
  let currentMileage: number | null = null;

  try {
    const access = await getReadableScope();
    canManage = access.isOwner;
    currentMileage = (await getMotorcycleOverview(access.scope)).motorcycle.currentMileage;
  } catch (error) {
    return <WorkspaceUnavailableState message={asAppError(error).message} />;
  }

  if (currentMileage === null) {
    return (
      <WorkspaceUnavailableState message="The current motorcycle mileage is unavailable, so service history cannot be displayed." />
    );
  }

  return (
    <main className="dashboard-shell history-shell">
      <MotorcycleNavigation active="history" canManage={canManage} />

      <div className="dashboard-content history-content">
        <header className="topbar history-topbar">
          <div>
            <p className="eyebrow">Maintenance history</p>
            <h1>Service history</h1>
            <p className="topbar-subtitle">
              Review completed work and keep the motorcycle&apos;s maintenance record in one place.
            </p>
          </div>
          <span className="scope-label">{canManage ? "Owner · editable" : "Guest · read only"}</span>
        </header>

        <MaintenanceHistoryPanel
          currentMileage={currentMileage}
          readOnly={!canManage}
        />

        <footer className="dashboard-footer">
          <span>MotoMemory © 2026</span>
          <i aria-hidden="true">•</i>
          <span>Vintage garage</span>
          <i aria-hidden="true">•</i>
          <span>Live service history</span>
        </footer>
      </div>
    </main>
  );
}
