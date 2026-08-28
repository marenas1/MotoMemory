export function WorkspaceUnavailableState({
  message = "The live MotoMemory workspace is unavailable right now.",
}: {
  message?: string;
}) {
  return (
    <main className="app-shell">
      <section className="empty-state-card" aria-labelledby="workspace-status-heading">
        <div className="motorcycle-visual" aria-hidden="true">⚠️</div>
        <h1 id="workspace-status-heading">Workspace unavailable</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}
