# MotoMemory Phase 4 — Completion and Handoff

Status: **conditionally ready for deployment** — code-level validation passed;
connected browser acceptance remains pending because the execution sandbox
could not start a reachable Playwright web server.

## Delivered operating model

- `/` and `/manual` are the normal application pages; guests open them without
  an account or sign-in.
- A local process with `MOTOMEMORY_RUNTIME_MODE=owner` renders the same pages
  with mileage, service, manual/OCR, and fact-correction controls enabled.
- A deployed process uses `MOTOMEMORY_RUNTIME_MODE=readonly` and serves live
  motorcycle, history, manual, OCR, search, question, fact, and PDF reads.
- Every state-changing route is guarded server-side and returns `403` in
  read-only mode before repository, Storage, OCR, or persistence work.
- Local owner saves update the live Supabase source and appear on the next
  deployed read. No publish, snapshot, or synchronization action exists.
- Passphrase, session-cookie, login, logout, Settings, Supabase Auth, and
  account-mapping code are not active dependencies.
- Migrations `001`–`011` remain immutable. Migration `010` is dormant history;
  it is not queried and must not be deleted or rewritten. Migration `011`
  seeds the owner-reported acquisition checkup and is safe to apply once.

## Configuration handoff

Local `.env.local`:

```dotenv
MOTOMEMORY_RUNTIME_MODE=owner
DATABASE_URL=
SUPABASE_PROJECT_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=manuals
```

Deployment:

```dotenv
MOTOMEMORY_RUNTIME_MODE=readonly
DATABASE_URL=
SUPABASE_PROJECT_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=manuals
```

Missing or malformed mode configuration is read-only. Production always
resolves to read-only, including when `owner` is accidentally configured.
Never expose the database URL, service-role key, Storage object key, or any of
these values through `NEXT_PUBLIC_` variables.

## Automated validation

The final checkout produced these results:

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run test:unit` | Passed — 124 tests |
| `npm run test:integration` | Passed — 56 tests |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| `PLAYWRIGHT_PORT=3101 npm run test:e2e` | Pending — sandbox web-server limitation |

To complete connected acceptance, run the following from the repository root
on the owner’s machine or deployment target:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
PLAYWRIGHT_PORT=3101 npm run test:e2e
npm run build
git diff --check
```

Connected checks that require the owner’s Supabase database or real PDF should
be run separately against a recoverable target. The sandbox Playwright run
could not start its configured web server and exited before browser tests ran;
this is documented as pending, not as a pass. No migration is required for the
runtime-mode switch.

## Operator acceptance

1. Start the local app with `MOTOMEMORY_RUNTIME_MODE=owner`; open `/` and
   `/manual` directly and confirm no sign-in step appears.
2. Verify one safe local edit in each available area: mileage, service record,
   and manual fact. Do not reupload the production manual unless recovery is
   intentional.
3. Deploy the same build with `MOTOMEMORY_RUNTIME_MODE=readonly` and confirm
   guests can read the live dashboard, history, manual/PDF, OCR, search,
   questions, facts, and citations without an account.
4. Send direct requests to each mutation route and confirm `403` plus no data,
   Storage, or OCR side effect.
5. Confirm a local edit is visible in the deployed application after refresh.
6. Confirm a missing or malformed mode, and production with `owner`, remain
   read-only.

The connected walkthrough is still pending until it is run against the real
Supabase project and the owner’s scanned manual outside the execution sandbox.

## Recovery and rollback

- To resume editing, stop the deployed editor if any, set the private local
  process to `MOTOMEMORY_RUNTIME_MODE=owner`, and restart it.
- If the deployed application is misconfigured, remove the mode variable or
  set it to `readonly`, then restart/redeploy.
- Database and Storage recovery uses the existing Supabase/PostgreSQL
  operator process. Runtime-mode cleanup does not transform motorcycle,
  mileage, manual, OCR, facts, or service-history data.
- Keep migrations `001`–`010` unchanged during rollback.

## Deferred work

Google OAuth, Supabase Auth, email recovery, multi-user roles, publish/snapshot
flows, mobile, GPS, date-based maintenance, and richer answer-model behavior
are not needed for this release.
