export default function MaintenanceLoading() {
  return (
    <main className="system-state" aria-busy="true" aria-live="polite">
      <span className="brand-symbol" aria-hidden="true">MM</span>
      <p>Loading maintenance outlook…</p>
      <p>Checking the live motorcycle schedule.</p>
    </main>
  );
}
