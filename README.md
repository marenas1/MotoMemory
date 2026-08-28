# MotoMemory

MotoMemory is a personal motorcycle maintenance companion for a 1981 Suzuki
GS750. The current Next.js application uses a private Supabase PostgreSQL
database and Supabase Storage for the source manual PDF.

The application has two runtime modes:

- `owner` is intended for the local editing process and is selected with
  `MOTOMEMORY_RUNTIME_MODE=owner`;
- `readonly` is the safe deployment mode: guests can read the live motorcycle
  state, service history, manual, OCR evidence, search, and retrieval-only
  questions, while state-changing routes are rejected;
- omitted or malformed mode configuration resolves to `readonly`, and
  production always resolves to `readonly`;
- owner changes appear on the next guest read without publishing a snapshot;
- mobile, GPS, multi-user accounts, Google OAuth, Supabase Auth, email
  delivery, and self-service recovery are not part of this release.

## Requirements

- Node.js 20.9 or newer.
- npm 11 or a compatible npm release.
- A private Supabase project with PostgreSQL and a private Storage bucket.
- Poppler and Tesseract for local scanned-manual ingestion.

The repository does not contain credentials, the real manual PDF, or OCR
output. Keep them outside Git.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set `DATABASE_URL` to the server-side PostgreSQL connection string. For the
private manual PDF, also set `SUPABASE_PROJECT_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`.

For local editing, set:

```env
MOTOMEMORY_RUNTIME_MODE=owner
```

For a deployed instance, omit the variable or set it explicitly to
`MOTOMEMORY_RUNTIME_MODE=readonly`. The resolver ignores `owner` when
`NODE_ENV=production`; request headers, query parameters, cookies, and bodies
cannot change the mode.

There is no login or passphrase in the local owner workflow. The process
running with `MOTOMEMORY_RUNTIME_MODE=owner` is the write boundary; keep that
process private and use `readonly` for any deployed instance.

Apply migrations `001` through `010` in order using the Supabase SQL Editor or
Supabase CLI:

```text
supabase/migrations/001_phase1_schema.sql
supabase/migrations/002_phase1_seed.sql
supabase/migrations/003_phase1_mileage_function.sql
supabase/migrations/004_phase2_manual_schema.sql
supabase/migrations/005_phase2_ocr_ingestion.sql
supabase/migrations/006_phase2_maintenance_facts.sql
supabase/migrations/007_phase3_maintenance_history.sql
supabase/migrations/008_phase4_identity_and_showcase.sql
supabase/migrations/009_phase4_public_rate_limits.sql
supabase/migrations/010_phase4_owner_login_rate_limits.sql
supabase/migrations/011_seed_acquisition_checkup.sql
supabase/migrations/012_fix_public_rate_limit_function.sql
```

Migrations 008 and 010 are retained migration history from earlier Phase 4
designs; their legacy identity and owner-login tables are dormant. Do not
delete or rewrite applied migrations. Migration 011 adds the owner-reported
18,000-mile general checkup to active maintenance items that have no existing
service history.

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). In local owner mode the
normal dashboard, maintenance outlook, service history, and manual pages are
editable without an account or a sign-in step. The dashboard shows the next
maintenance item; `/maintenance` shows the full upcoming list and `/history`
shows completed service records. Missing database or Storage configuration
produces an honest unavailable state.

## Manual workflow

The release supports one active uploaded PDF. The original PDF remains in the
private Storage bucket and is viewed through the application’s controlled PDF
route. OCR pages retain PDF page indexes and printed-page labels when detected.
Search and retrieval-only questions link back to source passages. If OCR or
retrieval fails, the UI reports the failure and does not invent evidence.

Keep the actual manual outside the repository. The local capability and full
acceptance commands write only temporary render/OCR files:

```bash
npm run manual:capability -- /absolute/path/to/manual.pdf --sample-pages 1,34,67
npm run manual:ocr:acceptance -- /absolute/path/to/manual.pdf --all-pages
```

After upload, the owner can start or retry ingestion from `/manual`. A
byte-for-byte duplicate upload is rejected. See the [Phase 2 acceptance
template](./docs/PHASE_2_ACCEPTANCE_RECORD_TEMPLATE.md) for recording results
outside Git.

## Public read limits

Guests do not need accounts. Starting limits are 60 manual searches, 10
retrieval-only questions, and 120 PDF/HEAD/range requests per 60 seconds per
trusted client IP. Sustained violations receive a cooldown. Responses use
`429` with `Retry-After`. Production must use a proxy that overwrites the
configured trusted client-IP header with one normalized address.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Next.js development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run test:unit` | Run pure unit tests |
| `npm run test:integration` | Run repository and route-boundary tests |
| `npm run test:e2e` | Run local Playwright smoke tests |
| `npm run build` | Create a production build |
| `npm run manual:capability -- /absolute/path/to/manual.pdf` | Render and OCR a small manual sample |
| `npm run manual:ocr:acceptance -- /absolute/path/to/manual.pdf --all-pages` | Render and OCR every page without storing it |
| `npm test` | Run unit, integration, and browser tests |

For a connected local-owner browser acceptance run, set
`MOTOMEMORY_OWNER_E2E=1` and run the test server with
`MOTOMEMORY_RUNTIME_MODE=owner`. This is only an E2E safety gate; it is not an
authentication or passphrase setting.

## Security boundary

The browser talks only to Next.js route handlers. PostgreSQL credentials,
Supabase service-role credentials, and Storage object keys remain server-side.
Every mutation independently resolves the server runtime mode before doing
work; UI hiding is not authorization. Production always resolves to
`readonly`, even if a deployment is misconfigured with `owner`.

More detail is in:

- [Local development](./docs/LOCAL_DEVELOPMENT.md)
- [Phase 4 read-only implementation plan](./docs/PHASE_4_READ_ONLY_IMPLEMENTATION_PLAN.md)
- [Phase 4 completion handoff](./docs/PHASE_4_COMPLETION_HANDOFF.md)
