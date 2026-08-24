# MotoMemory Phase 3 — Completion and Handoff

Status: **GO**

The Phase 3 implementation and automated coverage are on disk. This handoff
records only checks measured in the current workspace. The configured private
database was reached through the repository environment loader, and migration
007 plus the connected maintenance browser journey were measured without
printing credentials, private rows, or PDF content. The separate Phase 2
real-manual/OCR acceptance remains conditional.

## Scope delivered

- Motorcycle-scoped maintenance records with additive migration `007`.
- Create, list, edit, and explicit delete behavior for one maintenance item per record.
- Required performed-mileage validation against the current motorcycle mileage.
- `Other / unlinked` history that does not affect a manual-backed calculation.
- Deterministic latest-service selection by performed mileage, independent of insertion order.
- `Not recorded`, `Upcoming`, `Due`, `Overdue`, and `Unknown` outlook states.
- Explainable outlook cards with current mileage, interval, last service, target, remaining distance, service-record link, and manual source link where available.
- Phase 1 mileage and Phase 2 manual/source behavior retained through regression coverage.

## Automated validation record

These commands were run from the repository root during this handoff:

| Gate | Result | Evidence boundary |
|---|---|---|
| `npm run lint` | pass | ESLint completed successfully. |
| `npm run typecheck` | pass | TypeScript completed successfully. |
| `npm run test:unit` | pass — 17 files, 98 tests | All unit tests passed. |
| `npm run test:integration` | pass — 11 files, 42 tests | All integration tests passed. |
| `PLAYWRIGHT_PORT=3100 npm run test:e2e` | pass — 5 passed, 2 explicit skips | The configured connected dashboard, maintenance acceptance, manual workspace, upload/citation, and OCR-failure browser paths passed. The unavailable-state test skipped because the database is configured; the Phase 2 correction test skipped because `MOTOMEMORY_PHASE7_E2E` was not enabled. |
| `npm run build` | pass | Next.js 16.3.1 production build completed successfully. |

The Phase 3 unit and integration suites cover the full calculation matrix,
validation, motorcycle scope, persistence boundary, route contracts, source
metadata, and correction/deletion behavior. The connected browser acceptance
spec is [maintenance-history.spec.ts](../tests/e2e/maintenance-history.spec.ts);
it skips with an explicit reason when the required private database/source
fixture is unavailable.

## Migration and private database evidence

| Check | Result |
|---|---|
| `DATABASE_URL` present in this workspace | yes, via ignored `.env.local` (presence checked without reading or printing its value) |
| `psql` available | no |
| Supabase CLI available | no |
| Migration applied to configured private database | measured — migration 007 applied; table, mileage index, and mileage guard verified |
| Connected maintenance browser journey | measured — 1 passing acceptance test, included in the full E2E run |
| Private PDF, credentials, or private source data added to Git | no; repository scan and Git status performed |

Migration `007_phase3_maintenance_history.sql` is additive: it creates the
service-record table, scoped indexes, the same-motorcycle definition foreign
key, and the current-mileage guard without dropping or rewriting Phase 1/2
tables. Apply migrations `001` through `007` through the existing private
Supabase SQL Editor or Supabase CLI workflow before claiming the live database
gate.

## E2E acceptance evidence

The connected acceptance spec runs against the configured private database
with a clean source-linked maintenance definition and a cleanup-safe synthetic
record. It measured:

1. initial `Not recorded` state without a personalized target;
2. source-page traceability;
3. create at the due boundary and visible explanation inputs;
4. invalid future mileage rejection without a write;
5. edit to an overdue result;
6. explicit delete returning the item to `Not recorded` while retaining the source link.

Result: **pass — 1 test**. The record was deleted by the acceptance flow and
the test also has a `finally` cleanup guard.

## Known deviations and follow-up

1. `psql` and the Supabase CLI are absent in this workspace. The migration was
   applied transactionally with the repository's existing `pg` dependency,
   using only metadata verification output.
2. The live acceptance fixture requires an active source-linked definition and
   no existing record for that definition so it can cleanly exercise the
   no-history state without deleting owner data. If the private database is
   already populated, use a disposable isolated database or an explicitly
   prepared acceptance fixture.
3. Configured-database Playwright runs use one worker to stay within the
   private Supabase session-pool limit; this affects test parallelism only.
4. Phase 2's real-manual/OCR acceptance remains conditional as documented in
   [PHASE_2_COMPLETION_HANDOFF.md](./PHASE_2_COMPLETION_HANDOFF.md); this Phase 3
   record does not upgrade that evidence.
5. No behavior change requiring a CONOPS amendment was made during hardening;
   the implementation remains aligned with [PHASE_3_CONOPS.md](./PHASE_3_CONOPS.md).

## Handoff rules

- Do not commit credentials, the private PDF, OCR output, storage URLs, or private source text.
- Apply the additive migration only through the existing private database workflow.
- Use a disposable or isolated database for destructive acceptance setup; do not reset the owner's database.
- Keep service-record deletion scoped to the motorcycle and independent from manual facts, pages, chunks, and the PDF.
- Re-run the full validation commands and update the measured result table before any future release or handoff change.
