# Local Development

This document records the local Phase 1 environment for MotoMemory.

## Confirmed tools

The initial setup was inspected with:

```text
Node.js  v24.3.0
npm      11.4.2
pnpm    9.15.0
```

The project uses npm because it is available with the confirmed Node installation and keeps the initial setup to one package manager. The `package.json` records the npm version used during setup.

## Environment variables

Copy the committed template into a local, ignored file:

```bash
cp .env.example .env.local
```

`.env.local` is intentionally not committed. The template defines:

| Variable | Exposure | Use |
| --- | --- | --- |
| `DATABASE_URL` | Server-only secret | Private Supabase PostgreSQL connection string used by the server repository |
| `SUPABASE_PROJECT_URL` | Non-secret server configuration | Supabase Storage REST base URL for the private manual adapter |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret | Private Supabase Storage object operations for the manual PDF |
| `SUPABASE_STORAGE_BUCKET` | Server-only configuration | Private manual bucket name; defaults to `manuals` |
| `MOTOMEMORY_ANSWER_PROVIDER` | Server-only configuration | Answer-provider selector; `unavailable` is the safe Phase 6 default |

Do not add a `NEXT_PUBLIC_` prefix to database or storage credentials. The browser must not connect directly to the database or private storage. The service-role key is read only by the server-side storage adapter and is never sent to the browser.

Phase 6 does not silently select or call an external answer model. With `MOTOMEMORY_ANSWER_PROVIDER=unavailable` (the default), manual search and PDF browsing work, while questions return an explicit provider-unavailable state. Production provider selection remains a configuration and evaluation decision.

## Manual Supabase step

The owner must create a private Supabase project and copy its server-side PostgreSQL connection string into the local `.env.local` file. Credentials are intentionally absent from this environment and are not fabricated here.

After setting `DATABASE_URL`, apply the versioned migrations from the repository in order using the Supabase SQL Editor or the Supabase CLI:

```text
supabase/migrations/001_phase1_schema.sql
supabase/migrations/002_phase1_seed.sql
supabase/migrations/003_phase1_mileage_function.sql
supabase/migrations/004_phase2_manual_schema.sql
supabase/migrations/005_phase2_ocr_ingestion.sql
supabase/migrations/006_phase2_maintenance_facts.sql
```

The seed is intentionally idempotent and does not overwrite a manually corrected mileage value. Migration 004 creates the private `manuals` Storage bucket and manual metadata tables; it does not change the Phase 1 mileage function or provisional schedule row. Phase 1 does not enable RLS or authentication because the app is private and database access is server-side only. RLS, authentication, and an explicit owner/demo data scope are required before public deployment.

Keep the owner's real PDF outside the repository. After installing Poppler and Tesseract, run the full local OCR acceptance check with its absolute path:

```bash
npm run manual:ocr:acceptance -- /absolute/path/to/the/67-page-manual.pdf --all-pages
```

The command renders and OCRs every page, prints each 1-based PDF page result and detected printed label, and exits non-zero if a page cannot be rendered or OCR'd. It writes only operating-system temporary files.

To verify a setup without changing data, run the following read-only checks in the Supabase SQL Editor:

```sql
select id, make, model, model_year, current_mileage, mileage_unit,
       visual_state, visual_emoji
  from public.motorcycle_state
 where id = 'gs750';

select motorcycle_id, name, interval_miles, status, source
  from public.maintenance_definitions
 where motorcycle_id = 'gs750';
```

Do not use an automated reset against the personal hosted project. If a clean database is needed for tests, use a local Supabase stack or an isolated test project. A manual mileage correction should go through the application so it is recorded in `mileage_updates`.

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

The unit and integration suites run without hosted credentials. The default end-to-end suite verifies the disconnected state without `DATABASE_URL`; the connected journey runs when the private database is configured.

## Phase 2 manual workflow

Keep the owner's actual scanned manual outside the repository, for example:

```text
/absolute/path/to/owner/67-page-gs750-manual.pdf
```

The local capability command exercises the first, middle, and final pages:

```bash
npm run manual:capability -- /absolute/path/to/owner/67-page-gs750-manual.pdf \
  --sample-pages 1,34,67
```

The full local acceptance command exercises every page and writes only temporary render/OCR files:

```bash
npm run manual:ocr:acceptance -- /absolute/path/to/owner/67-page-gs750-manual.pdf \
  --all-pages
```

Install Poppler and Tesseract before running either command. The application uses the same server-side PDF renderer and Tesseract CLI adapter for configured ingestion. Record the command path, file size, page count, SHA-256, available pages, failed pages, searchable chunks, extracted facts, and question-evaluation results in a copy of [the acceptance record template](./PHASE_2_ACCEPTANCE_RECORD_TEMPLATE.md) kept under `/tmp`, `local-acceptance/`, or another ignored location. Do not paste OCR text, the PDF, storage URLs, or credentials into Git.

After a successful upload, the Manual workspace starts ingestion. If processing fails, the original PDF remains available and the workspace shows the failed state and page accounting. Select `Retry processing` to resume failed or missing pages; successful page rows are retained and are not OCR'd again. A duplicate byte-for-byte upload is rejected with a conflict and does not create a new document.

For local reset behavior, do not run a destructive reset against the personal Supabase project. Use a disposable local Supabase stack or isolated test project, apply migrations `001` through `006` in order, and remove only the test project's manual row/object when needed. The application has no Phase 2 delete-manual UI. If a failed local upload leaves an object, use the exact `storage_key` from the isolated database row and remove only that object after verifying it belongs to the test document; never use a recursive bucket cleanup.

## Answer-provider configuration

The safe default is:

```dotenv
MOTOMEMORY_ANSWER_PROVIDER=unavailable
```

This keeps PDF browsing, OCR status, search, and source citations available while question answering returns an explicit provider-unavailable state. No answer model is selected for Phase 2 until the real manual has been OCR'd and the ten-question evaluation is recorded. Do not add an API key to the repository or expose provider credentials with a `NEXT_PUBLIC_` variable. When a provider is eventually selected, add its server-only credential and adapter contract here before changing the default.
