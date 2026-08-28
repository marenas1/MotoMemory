import { connection } from "next/server";

import { MaintenanceOutlook } from "@/components/maintenance-outlook";
import { MotorcycleNavigation } from "@/components/motorcycle-navigation";
import { WorkspaceUnavailableState } from "@/components/workspace-unavailable-state";
import { getMotorcycleOverview } from "@/lib/data/motorcycle-repository";
import type { MotorcycleOverview } from "@/lib/domain/types";
import { asAppError } from "@/lib/server/errors";
import { getReadableScope } from "@/lib/server/read-access";

export default async function MaintenancePage() {
  await connection();

  let canManage = false;
  let overview: MotorcycleOverview | null = null;

  try {
    const access = await getReadableScope();
    canManage = access.isOwner;
    overview = await getMotorcycleOverview(access.scope);
  } catch (error) {
    return <WorkspaceUnavailableState message={asAppError(error).message} />;
  }

  if (!overview) {
    return <WorkspaceUnavailableState />;
  }

  return (
    <main className="dashboard-shell maintenance-shell">
      <MotorcycleNavigation active="maintenance" canManage={canManage} />

      <div className="dashboard-content maintenance-content">
        <header className="topbar maintenance-topbar">
          <div>
            <p className="eyebrow">Maintenance outlook</p>
            <h1>Upcoming maintenance</h1>
            <p className="topbar-subtitle">
              See every configured maintenance item and why it is coming up next.
            </p>
          </div>
          <span className="scope-label">{canManage ? "Owner · editable" : "Guest · read only"}</span>
        </header>

        <MaintenanceOutlook items={overview.maintenanceOutlook} />

        <footer className="dashboard-footer">
          <span>MotoMemory © 2026</span>
          <i aria-hidden="true">•</i>
          <span>Vintage garage</span>
          <i aria-hidden="true">•</i>
          <span>Live maintenance outlook</span>
        </footer>
      </div>
    </main>
  );
}
