export default function ManualLoading() {
  return (
    <main className="system-state" aria-busy="true" aria-live="polite">
      <span className="brand-symbol" aria-hidden="true">MM</span>
      <p>Loading the manual workspace…</p>
      <p>Checking the private document status.</p>
    </main>
  );
}
