# Local Development

This document is the operator runbook for the current MotoMemory application:
live guest reads, a process-wide owner/read-only runtime boundary, private
Supabase PostgreSQL, and private Supabase Storage for the manual PDF.

## Confirmed tools

The project uses Node.js 20.9 or newer and npm. Poppler and Tesseract are also
needed when uploading or locally validating the scanned manual. Check them
before a manual acceptance run:

```bash
node --version
npm --version
pdftoppm -v
tesseract --version
```

## Environment variables

Copy the committed template into the ignored local file:

```bash
cp .env.example .env.local
```

| Variable | Exposure | Use |
| --- | --- | --- |
| `DATABASE_URL` | Server-only secret | Private Supabase PostgreSQL connection |
| `SUPABASE_PROJECT_URL` | Server-only configuration | Supabase Storage base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret | Private Storage operations for the manual PDF |
| `SUPABASE_STORAGE_BUCKET` | Server-only configuration | Private manual bucket; normally `manuals` |
| `MOTOMEMORY_RUNTIME_MODE` | Server-only configuration | `owner` for local editing; `readonly` for deployments; missing or invalid means `readonly` |
| `MOTOMEMORY_TRUSTED_CLIENT_IP_HEADER` | Server-only deployment configuration | Header overwritten by the trusted production proxy |
| `MOTOMEMORY_PUBLIC_SEARCH_PER_MINUTE` | Server-only public policy | Search limit; default `60` per minute per IP |
| `MOTOMEMORY_PUBLIC_QUESTION_PER_MINUTE` | Server-only public policy | Retrieval-only question limit; default `10` per minute per IP |
| `MOTOMEMORY_PUBLIC_PDF_PER_MINUTE` | Server-only public policy | PDF/HEAD/range limit; default `120` per minute per IP |
| `MOTOMEMORY_PUBLIC_THROTTLE_SECONDS` | Server-only public policy | Public abuse cooldown; default `300` seconds |
| `MOTOMEMORY_PUBLIC_THROTTLE_AFTER_VIOLATIONS` | Server-only public policy | Violations before public cooldown; default `3` |
| `MOTOMEMORY_APP_ORIGIN` | Server-only deployment configuration | Canonical public origin for same-origin checks when a proxy changes the request host; otherwise optional |
| `MOTOMEMORY_CLIENT_IP_MODE` | Local-only configuration | Deterministic local mode; production must use trusted proxy mode |
| `MOTOMEMORY_TEST_CLIENT_IP` | Local/unit-only configuration | Deterministic test address when no proxy is present |
| `MOTOMEMORY_ANSWER_PROVIDER` | Server-only configuration | Keep `unavailable` until an answer provider is evaluated |

Never add `NEXT_PUBLIC_` to database, Storage, or runtime-mode values.
The browser must not connect directly to PostgreSQL or private Storage. The
application does not use Google OAuth, Supabase Auth, email delivery, or an
account mapping for owner access. Local owner authority comes from the server
process runtime mode, not from a browser flag or credential.

## Runtime modes

The runtime mode is resolved from the server environment only. It never reads
a request header, query parameter, cookie, or body. Use explicit owner mode
only on the private local editing process:

```env
MOTOMEMORY_RUNTIME_MODE=owner
```

Use `readonly` for a deployed instance, or omit the variable to get the same
safe default:

```env
MOTOMEMORY_RUNTIME_MODE=readonly
```

Malformed values also fail closed to `readonly`, and production forces
`readonly` even if `owner` is configured. The mutation routes resolve this
mode independently on every request before repository, Storage, or OCR work.
The local owner UI is the normal editable UI; the deployed UI is the same live
read surface with mutation controls disabled and an explanatory read-only
message.

## Database and Storage setup

Create a private Supabase project, copy its server-side PostgreSQL connection
string into `DATABASE_URL`, and configure the three Storage variables. Apply
the versioned migrations in order using the Supabase SQL Editor or Supabase
CLI:

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
```

Migrations `001`–`007` contain the live motorcycle, manual, OCR, facts, and
history state. Migration `009` provides public-read abuse counters. Migration
`010` is retained history for an earlier owner-login design and is dormant.
Migration `008` is retained history from an earlier identity/projection design;
its legacy tables are dormant and the current application does not consult
them. Do not delete, rewrite, reorder, or reset applied migrations on the
owner’s database.

Migration `004` creates the private manual bucket and manual metadata tables.
The service-role key is used only by the server-side Storage adapter. Browser
PDF access goes through `/api/manual/file`, which does not expose the Storage
object key.

## Run the application

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With
`MOTOMEMORY_RUNTIME_MODE=owner`, `/` and `/manual` are the editable local
owner workspace without a login step. With `readonly`, the same routes remain
live reads and all mutations return a stable `403` read-only response.

## Trusted client IP and public limits

The local resolver uses a deterministic RFC 5737 test address unless production
or trusted-proxy mode is selected. Production must configure a proxy that
overwrites the configured header with exactly one normalized address. The app
rejects comma-separated chains and arbitrary alternate caller-selected headers.

Initial public limits are 60 searches, 10 retrieval-only questions, and 120
PDF/HEAD/range requests per 60 seconds per trusted client IP. Violations return
`429` with numeric `Retry-After`; sustained offenders receive the configured
cooldown. These are server policies and can be tuned later.

## Manual and OCR acceptance

Keep the real scanned PDF outside the repository, for example:

```text
/absolute/path/to/owner/67-page-gs750-manual.pdf
```

The local capability command exercises selected pages:

```bash
npm run manual:capability -- /absolute/path/to/owner/67-page-gs750-manual.pdf \
  --sample-pages 1,34,67
```

The full acceptance command exercises every page and writes only temporary
render/OCR files:

```bash
npm run manual:ocr:acceptance -- /absolute/path/to/owner/67-page-gs750-manual.pdf \
  --all-pages
```

The application supports one active PDF. It preserves the original PDF while
OCR runs, reports page-level failures, retains both PDF page indexes and
printed-page labels, rejects byte-for-byte duplicate uploads, and allows the
owner to retry incomplete pages. Record page count, SHA-256, failed pages,
searchable pages, extracted facts, and retrieval evaluation outside Git using
the [Phase 2 acceptance template](./PHASE_2_ACCEPTANCE_RECORD_TEMPLATE.md).

## Validation commands

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
PLAYWRIGHT_PORT=3100 npm run test:e2e
npm run build
git diff --check
```

Playwright local-owner checks require `MOTOMEMORY_OWNER_E2E=1` and a test
server using `MOTOMEMORY_RUNTIME_MODE=owner`; this variable only enables the
destructive-test safety gate and is not authentication. Tests needing a connected
database or manual explicitly skip when those values are absent. A sandbox may prevent the browser server from
binding a loopback port with `listen EPERM`; report that limitation rather than
claiming connected acceptance.

## Operating boundary

- Keep the local owner process private because `owner` enables mutations.
- Deploy with `readonly`; production also forces this safe mode.
- Change `MOTOMEMORY_RUNTIME_MODE` and restart the process when switching
  between local editing and deployed read-only operation.
- Do not store database credentials, service-role keys, PDFs, OCR output, or
  Storage URLs in Git, browser storage, tickets, or logs.
