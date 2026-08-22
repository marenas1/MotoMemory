// Vitest-only shim. Next.js enforces this boundary in the application build;
// unit and integration tests run in a Node process and need to import the
// server-side modules without triggering the package's client-side guard.
export {};
