import { connection } from "next/server";

import { MotorcycleMainView } from "@/components/motorcycle-main-view";
import { getMotorcycleOverview } from "@/lib/data/motorcycle-repository";
import type { MotorcycleOverview } from "@/lib/domain/types";
import { asAppError } from "@/lib/server/errors";

export default async function HomePage() {
  // The dashboard is backed by live motorcycle state. Do not freeze the
  // current mileage into a static build artifact.
  await connection();

  let overview: MotorcycleOverview | null = null;
  let loadMessage =
    "The database-backed motorcycle state is not available yet.";

  try {
    overview = await getMotorcycleOverview();
  } catch (error) {
    loadMessage = asAppError(error).message;
    overview = null;
  }

  if (!overview) {
    return (
      <main className="app-shell">
        <header className="app-header">
          <div>
            <p className="eyebrow">MotoMemory</p>
            <h1>Personal motorcycle maintenance companion</h1>
          </div>
        </header>

        <section className="empty-state-card" aria-labelledby="connection-status">
          <div className="motorcycle-visual" aria-hidden="true">🏍️</div>
          <h2 id="connection-status">Motorcycle state is not connected</h2>
          <p>{loadMessage}</p>
          <p>Apply the Phase 1 migrations after configuring the private Supabase PostgreSQL connection.</p>
        </section>
      </main>
    );
  }

  return <MotorcycleMainView initialOverview={overview} />;
}
