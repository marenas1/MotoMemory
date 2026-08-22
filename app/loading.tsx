export default function Loading() {
  return (
    <main className="system-state" aria-busy="true" aria-live="polite">
      <span className="brand-symbol" aria-hidden="true">MM</span>
      <p>Loading MotoMemory…</p>
      <p>Checking for the connected motorcycle state.</p>
    </main>
  );
}
