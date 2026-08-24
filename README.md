# MotoMemory

MotoMemory is a personal motorcycle maintenance companion for a 1981 Suzuki GS750. Phase 1 is a local Next.js application backed by a private Supabase PostgreSQL database.

The current Phase 1 state is intentionally small:

- One motorcycle: 1981 Suzuki GS750.
- Initial mileage: 18,501 mi.
- Provisional maintenance cadence: one general check every 1,000 mi.
- Temporary motorcycle visual: 🏍️.
- Manual mileage updates, including lower corrections.
- A private Phase 2 manual workspace with no committed manual PDF.
- No account, user profile, authentication, mobile client, GPS, service history, or selected answer model.

## Requirements

- Node.js 20.9 or newer.
- npm 11 or a compatible npm release.
- A private Supabase project with a PostgreSQL connection string.

The repository does not contain database credentials. Create the private project yourself and keep its connection string in `.env.local`.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local` to the server-side PostgreSQL connection string for the private Supabase project. Do not add a `NEXT_PUBLIC_` prefix and do not commit `.env.local`.

For Phase 2 private manual storage, also set `SUPABASE_PROJECT_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`. Keep the service-role key out of browser code and do not commit it.

Manual questions default to a fail-closed, provider-unavailable state until an answer provider is selected and configured. Evidence search and private PDF browsing do not require an answer-model credential.

Apply the versioned migrations in order using the Supabase SQL Editor or Supabase CLI:

```text
supabase/migrations/001_phase1_schema.sql
supabase/migrations/002_phase1_seed.sql
supabase/migrations/003_phase1_mileage_function.sql
supabase/migrations/004_phase2_manual_schema.sql
supabase/migrations/005_phase2_ocr_ingestion.sql
supabase/migrations/006_phase2_maintenance_facts.sql
supabase/migrations/007_phase3_maintenance_history.sql
```

Then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If `DATABASE_URL` is absent or the migrations have not been applied, the app shows an explicit disconnected state instead of fabricating motorcycle data.

More environment and database guidance is in [docs/LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md).

Phase 2 hardening and owner acceptance are documented in the [Phase 2 completion and handoff note](./docs/PHASE_2_COMPLETION_HANDOFF.md). The real 67-page manual and its measured acceptance record must remain outside Git; use the [acceptance record template](./docs/PHASE_2_ACCEPTANCE_RECORD_TEMPLATE.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Next.js development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run build` | Create a production build |
| `npm run test:unit` | Run pure mileage and maintenance tests |
| `npm run test:integration` | Run safe repository-boundary tests |
| `npm run test:e2e` | Run local Playwright smoke tests |
| `npm run manual:capability -- /absolute/path/to/manual.pdf` | Render and OCR a small sample of a private manual |
| `npm run manual:ocr:acceptance -- /absolute/path/to/manual.pdf --all-pages` | Render and OCR every page of the private acceptance PDF without storing it in Git |
| `npm test` | Run unit, integration, and browser tests |

For a clean Phase 2 validation run, run the commands serially. Playwright needs a local loopback port and should not be started in parallel with lint or the production build. Set `PLAYWRIGHT_PORT` if port 3000 is already occupied.

## Phase 1 behavior

At 18,501 mi, the provisional next target is 19,000 mi with 499 mi remaining. An exact target is shown as due. Without maintenance history, Phase 1 does not claim that a task is overdue. The schedule is labeled provisional and will be replaced with manual-backed definitions in Phase 2.

Mileage is validated at the API boundary, accepts zero and lower corrections, supports up to two decimal places, and never silently rounds invalid precision. A stale page cannot overwrite a newer persisted value without refreshing first.

## Security and scope boundary

The browser talks to Next.js route handlers; PostgreSQL credentials stay server-side. Phase 1 intentionally does not enable authentication or RLS because the app is private and tailored to one owner. Authentication, RLS, and an explicit owner/demo scope are required before public deployment or a Vercel-hosted demo.

The 🏍️ placeholder is intentional. The final motorcycle image and frontend visual system will be defined in a later design document.
