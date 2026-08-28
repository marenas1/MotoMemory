export default function HistoryLoading() {
  return (
    <main className="system-state" aria-busy="true" aria-live="polite">
      <span className="brand-symbol" aria-hidden="true">MM</span>
      <p>Loading service history…</p>
      <p>Checking the live motorcycle record.</p>
    </main>
  );
}
