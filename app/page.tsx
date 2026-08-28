import { connection } from "next/server";

import { MotorcycleMainView } from "@/components/motorcycle-main-view";
import { getMotorcycleOverview } from "@/lib/data/motorcycle-repository";
import type { MotorcycleOverview } from "@/lib/domain/types";
import { getReadableScope } from "@/lib/server/read-access";
import { asAppError } from "@/lib/server/errors";

export default async function HomePage() {
  await connection();

  let overview: MotorcycleOverview | null = null;
  let canManage = false;
  let loadMessage = "The live motorcycle state is not available right now.";

  try {
    const access = await getReadableScope();
    canManage = access.isOwner;
    overview = await getMotorcycleOverview(access.scope);
  } catch (error) {
    loadMessage = asAppError(error).message;
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
          <p>Confirm the database connection and applied migrations, then try again.</p>
        </section>
      </main>
    );
  }

  return <MotorcycleMainView initialOverview={overview} canManage={canManage} />;
}
