import { connection } from "next/server";
import { ManualWorkspace } from "@/components/manual-workspace";
import { MotorcycleNavigation } from "@/components/motorcycle-navigation";
import { WorkspaceUnavailableState } from "@/components/workspace-unavailable-state";
import { getReadableScope } from "@/lib/server/read-access";
import { asAppError } from "@/lib/server/errors";

type SearchParams = Promise<{
  page?: string | string[];
  printedPage?: string | string[];
}>;

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePageTarget(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : null;
}

function parsePrintedPageLabel(value: string | undefined): string | null {
  if (!value || value.length > 64 || !/^[\p{L}\p{N} ._/#-]+$/u.test(value)) {
    return null;
  }

  return value;
}

export default async function ManualPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  const query = await searchParams;
  let canManage = false;
  try {
    canManage = (await getReadableScope()).isOwner;
  } catch (error) {
    const appError = asAppError(error);
    return <WorkspaceUnavailableState message={appError.message} />;
  }
  const pageTarget = parsePageTarget(firstQueryValue(query.page));
  const printedPageLabel = parsePrintedPageLabel(
    firstQueryValue(query.printedPage),
  );

  return (
    <main className="dashboard-shell manual-shell">
      <MotorcycleNavigation active="manual" canManage={canManage} />
      <div className="dashboard-content manual-content">
        <header className="topbar manual-topbar">
          <div>
            <p className="eyebrow">Source manual</p>
            <h1>GS750 service manual</h1>
            <p className="topbar-subtitle">
              Browse the original PDF. OCR and answers are separate from this source view.
            </p>
          </div>
          <span className="scope-label">{canManage ? "Local owner mode" : "Read-only deployment"}</span>
        </header>

        <ManualWorkspace
          initialPageTarget={pageTarget}
          initialPrintedPageLabel={printedPageLabel}
          canManage={canManage}
        />

        <footer className="dashboard-footer">
          <span>MotoMemory © 2026</span>
          <i aria-hidden="true">•</i>
          <span>Vintage garage</span>
          <i aria-hidden="true">•</i>
          <span>Live source workspace</span>
        </footer>
      </div>
    </main>
  );
}
