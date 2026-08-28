# MotoMemory Phase 4 — Read-Only Deployment and Local Owner Mode

Status: **CONDITIONALLY COMPLETE — code and automated validation passed; connected Playwright acceptance is pending a sandbox web-server limitation**

This plan replaces the passphrase-authenticated deployment model with two
operating modes for the same MotoMemory application:

- **Local owner mode:** the owner runs `npm run dev` on the owner’s computer
  and can use the existing mileage, service-record, manual, OCR, and fact
  editing workflows without signing in.
- **Deployed read-only mode:** guests open the deployed application at `/` or
  `/manual` and see live data from the real Supabase PostgreSQL and Storage
  source. Every state-changing route rejects the request server-side.

The database and Storage remain the source of truth. A local owner change is
therefore visible to the deployed application on its next no-store read or
refresh. There is no publish action, snapshot, synchronization step, Google
OAuth flow, Supabase Auth flow, email delivery, passphrase, or owner login.

## 1. Outcome and boundaries

### Required outcome

MotoMemory must support this workflow:

```text
Owner computer                         Deployed application
----------------                         -------------------
npm run dev                             / and /manual
MOTOMEMORY_RUNTIME_MODE=owner           MOTOMEMORY_RUNTIME_MODE=readonly
        |                                        |
        +---- writes live Supabase ------------->+
                                                 |
                                      live read-only views
```

The local application continues to use the existing domain logic and
repositories. The deployed application continues to use the existing live
read paths, PDF viewer, OCR search, retrieval-only questions, facts, mileage,
and maintenance-history DTOs.

### In scope

- A server-only runtime-mode configuration with `owner` and `readonly` modes.
- A safe default in which an omitted or invalid mode is read-only.
- Explicit local owner-mode enablement for `npm run dev`.
- Server-side rejection of all mutation routes in deployed read-only mode.
- Removal of passphrase, session-cookie, login, logout, and login-rate-limit
  behavior from the active application.
- Removal of the Settings/login UX and owner-only permission redirects that
  exist only for passphrase authentication.
- Preservation of live guest reads, public PDF access, OCR/search/question
  behavior, domain validation, Supabase Storage, and parameterized database
  access.
- Documentation for local editing, deployment, security, and recovery.

### Explicitly out of scope

- A second database, public snapshot, projection, publish workflow, or data
  export/import process.
- Google OAuth, Supabase Auth, email/password login, magic links, passkeys,
  email recovery, or any multi-user account system.
- Browser-based owner editing of the deployed application.
- Changing motorcycle, mileage, service, manual, OCR, fact, or retrieval domain
  rules unless required to preserve their existing behavior under the mode
  guard.
- Deleting or rewriting migrations that may already have been applied.

## 2. Configuration contract

Use one server-only variable:

```env
MOTOMEMORY_RUNTIME_MODE=owner
```

Allowed values are exactly:

- `owner` — enables mutation routes for local development only.
- `readonly` — enables live reads and rejects all mutations.

The resolver must apply this policy:

1. If `MOTOMEMORY_RUNTIME_MODE` is omitted, use `readonly`.
2. If the value is `readonly`, use read-only behavior in every environment.
3. If the value is `owner`, allow it only when `NODE_ENV !== "production"`.
4. If `owner` is requested in production, fail closed as `readonly` and emit a
   server-side configuration warning without exposing credentials or details
   to the browser.
5. If the value is malformed, fail closed as `readonly` rather than enabling
   writes accidentally.

This makes a production deployment safe even when the mode variable is missing
or mistyped. The deployment should normally omit the variable or set it
explicitly to `readonly`. The local `.env.local` should explicitly contain:

```env
MOTOMEMORY_RUNTIME_MODE=owner
```

The existing data and Storage configuration remains server-only:

```env
DATABASE_URL=...
SUPABASE_PROJECT_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=manuals
```

The following passphrase-era variables become obsolete and must be removed
from active examples and operator setup instructions:

```env
MOTOMEMORY_OWNER_PASSPHRASE_HASH
MOTOMEMORY_OWNER_SESSION_SECRET
MOTOMEMORY_OWNER_SESSION_TTL_SECONDS
MOTOMEMORY_OWNER_LOGIN_MAX_FAILURES
MOTOMEMORY_OWNER_LOGIN_WINDOW_SECONDS
MOTOMEMORY_OWNER_LOGIN_COOLDOWN_SECONDS
```

Public read-abuse controls remain active because they protect guest search,
retrieval-question, and PDF routes:

```env
MOTOMEMORY_TRUSTED_CLIENT_IP_HEADER=...
MOTOMEMORY_PUBLIC_SEARCH_PER_MINUTE=60
MOTOMEMORY_PUBLIC_QUESTION_PER_MINUTE=10
MOTOMEMORY_PUBLIC_PDF_PER_MINUTE=120
MOTOMEMORY_PUBLIC_THROTTLE_SECONDS=300
MOTOMEMORY_PUBLIC_THROTTLE_AFTER_VIOLATIONS=3
```

## 3. Access model and route behavior

### Local owner mode

When the local server resolves `owner` mode:

- `/` and `/manual` render the normal editable application.
- Existing mileage, service, manual-upload, OCR-ingestion/retry, and fact
  correction controls remain available.
- Mutation routes execute their existing validation, transaction, Storage, and
  domain logic.
- No login page, owner cookie, auth subject, or passphrase is consulted.
- The local process is the owner boundary. It must not be treated as a public
  deployment.

### Deployed read-only mode

When the server resolves `readonly` mode:

- `/` and `/manual` render the normal live application in guest/read-only form.
- Guests can see current motorcycle state, maintenance outlook, service
  history, the original PDF, OCR progress/facts, searchable passages, and
  retrieval-only question results.
- `GET` and the existing read-oriented `POST` routes for search/questions
  remain available and retain their public rate limits.
- The PDF route remains server-mediated and does not expose Storage object keys.
- All state-changing requests return a generic `403`/read-only application
  error before repository transactions, file uploads, OCR work, or fact writes.
- UI controls may be hidden or labeled read-only for clarity, but UI state is
  never the authorization mechanism.

### Mutation inventory

The implementation must explicitly cover every current mutation entry point:

| Capability | Route area | Read-only behavior |
|---|---|---|
| Mileage update | `app/api/motorcycle/mileage/route.ts` | Reject `PATCH` before domain mutation |
| Create service record | `app/api/maintenance/records/route.ts` | Reject `POST` before repository call |
| Edit/delete service record | `app/api/maintenance/records/[recordId]/route.ts` | Reject `PATCH` and `DELETE` before repository call |
| Manual upload | `app/api/manual/route.ts` | Reject upload `POST` before Storage/database work |
| OCR ingestion/retry | `app/api/manual/ingest/route.ts` | Reject `POST` before worker/ingestion work |
| Fact correction | `app/api/manual/facts/route.ts`, `app/api/manual/facts/[factId]/route.ts` | Reject `PATCH` before fact persistence |
| Login/logout | `app/api/auth/**` | Remove from active route surface or return an intentional gone/not-supported response |

The guard must be centralized and server-only. A preferred shape is a small
helper such as `requireOwnerMode()` or `assertMutationMode()` that resolves
the runtime mode and throws an `AppError` with status `403` when the mode is
not `owner`. Each mutation route calls it before parsing expensive input or
opening a database transaction. Existing same-origin checks and request-size
limits should remain where they still apply.

## 4. Sequential implementation phases

The phases are ordered. A later phase may begin only after the preceding
phase’s go/no-go criteria pass.

### Phase A — Runtime-mode boundary and configuration

**Objective:** Introduce an explicit, fail-closed owner/read-only mode without
removing the current passphrase path yet.

#### Exact file areas

Add:

- `lib/server/runtime-mode.ts` — parse `MOTOMEMORY_RUNTIME_MODE`, enforce the
  production read-only rule, and expose a server-only mode type/resolver.
- `lib/server/mutation-guard.ts` — provide `requireOwnerMode()` or
  `assertMutationMode()` and a consistent read-only `AppError`.

Change:

- `.env.example` — add `MOTOMEMORY_RUNTIME_MODE=owner` with a warning that
  local owner mode is never suitable for production; remove passphrase setup
  instructions only after Phase C removes the implementation.
- `lib/server/errors.ts` — add a stable read-only error code/message if the
  existing error taxonomy does not already support one.
- `README.md`, `docs/LOCAL_DEVELOPMENT.md` — describe the two-mode model and
  the explicit local setting.

#### Design requirements

- The mode resolver must not read a browser header, query parameter, cookie,
  or client-provided flag.
- `owner` must never be honored when `NODE_ENV=production`.
- Missing, malformed, or unsafe configuration must resolve to `readonly`.
- The helper must be usable in route handlers and server-rendered page logic
  without importing client modules.
- Read APIs must not require owner mode and must continue working when the
  mode is omitted.

#### Phase A go/no-go

**Go only if:** unit tests prove that local explicit owner mode enables writes,
production defaults to read-only, missing/malformed values default to
read-only, and no request-controlled input can change the resolved mode.

**No-go if:** production can be switched to owner mode through environment
ambiguity or request input, or guest reads require owner-mode configuration.

### Phase B — Mutation guards and local owner UX

**Objective:** Make local owner mode the authorization boundary and make the
normal local UI editable without any Settings/login flow.

#### Exact file areas

Change every mutation route listed in Section 3:

- `app/api/motorcycle/mileage/route.ts`
- `app/api/maintenance/records/route.ts`
- `app/api/maintenance/records/[recordId]/route.ts`
- `app/api/manual/route.ts`
- `app/api/manual/ingest/route.ts`
- `app/api/manual/facts/route.ts`
- `app/api/manual/facts/[factId]/route.ts`

Each route must call the centralized mode guard before its repository,
Storage, OCR, or persistence side effect. In `owner` mode it should preserve
the existing validation and behavior. In `readonly` mode it should return the
same stable error shape and must not call the underlying mutation dependency.

Change the active UI areas:

- `components/motorcycle-main-view.tsx` — derive editability from the
  server-provided mode, not a user-controlled flag; show local owner controls
  in owner mode and read-only explanatory text in deployed mode.
- `components/maintenance-history-panel.tsx` — preserve public history reads;
  hide create/edit/delete controls in read-only mode without treating that as
  security.
- `components/manual-workspace.tsx` — preserve guest PDF/search/question
  behavior; show upload/OCR controls only in owner mode.
- `components/manual-facts-panel.tsx` — preserve fact visibility and source
  traceability; show correction controls only in owner mode.
- `components/motorcycle-navigation.tsx` — remove owner-login/settings links
  and logout controls once Phase C removes those routes; keep normal dashboard
  and manual navigation.

The page server components should resolve the mode once and pass a narrow
`canManage`/`readOnly` presentation value to client components. The API guard
must independently resolve the mode for every mutation request.

Remove owner permission redirects from guest controls. A deployed guest may
see text such as “Read-only deployment” rather than a login link. The local
owner should use the normal dashboard directly.

#### Phase B go/no-go

**Go only if:** with `MOTOMEMORY_RUNTIME_MODE=owner`, local mileage/service/
manual/OCR/fact workflows function without login; with `readonly`, every
mutation route returns `403` before its dependency is invoked; `/` and
`/manual` still render live reads; and no client flag can enable a write.

**No-go if:** a mutation route is missing the guard, a read-only request can
start OCR or alter Storage, or local owner mode requires passphrase/session
configuration.

### Phase C — Remove passphrase/auth and obsolete Settings workflow

**Objective:** Remove the authentication machinery that is no longer part of
the operating model after the runtime-mode boundary is verified.

#### Exact file areas

Remove from the active application:

- `lib/server/owner-passphrase.ts`
- `lib/server/owner-session.ts`
- `lib/server/owner-login-rate-limit.ts`
- `lib/server/auth.ts` and `lib/server/auth-types.ts` if they contain no
  remaining read or domain abstractions; otherwise simplify them to remove
  authentication and owner identity concepts.
- `lib/server/owner-navigation.ts`
- `lib/server/same-origin.ts` only if no remaining state-changing route needs
  it; otherwise retain its mutation-route use.
- `scripts/generate-owner-passphrase-hash.mjs`
- `components/owner-login-form.tsx`
- `components/logout-button.tsx`
- `components/session-expiry-notice.tsx`
- `components/private-access-state.tsx` if it is only used for owner login;
  retain or simplify it if it still serves a genuine database/Storage
  unavailable state.

Remove or replace routes:

- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/settings/page.tsx`
- `app/owner/**` compatibility routes if present

The routes may be removed entirely, or a minimal not-supported response may be
retained temporarily if deployment links or bookmarks need a controlled
transition. No active route should imply that a passphrase or user account can
unlock deployed writes.

Simplify server reads and page authorization:

- `lib/server/read-access.ts` — remove session-based owner detection while
  retaining the server-side read scope used by live guest reads.
- `app/page.tsx` and `app/manual/page.tsx` — derive presentation mode from
  `runtime-mode.ts`, not `requireOwnerScope()`.
- `app/api/motorcycle/route.ts`, `app/api/maintenance/records/route.ts`,
  `app/api/manual/route.ts`, `app/api/manual/facts/route.ts`,
  `app/api/manual/search/route.ts`, `app/api/manual/questions/route.ts`, and
  `app/api/manual/file/route.ts` — preserve the current live read behavior;
  remove authentication branches that were only needed for owner sessions.

Dependencies/configuration:

- Remove `@supabase/ssr` if it is still present.
- Keep `@supabase/supabase-js` because the server still uses Supabase Storage.
- Remove passphrase/session/login variables from `.env.example` and all active
  operator docs.
- Remove passphrase-specific E2E environment variables and fixtures.

#### Migration treatment

- Do not delete, rewrite, or roll back `supabase/migrations/010_phase4_owner_login_rate_limits.sql`.
- It may already be applied and is safe to leave as dormant historical schema.
- It will no longer be queried by the application after this phase.
- Migration `009_phase4_public_rate_limits.sql` remains active and must stay in
  place because it protects public search, questions, and PDF access.
- Preserve migrations `001` through `010` as immutable history.

#### Phase C go/no-go

**Go only if:** `rg`/dependency analysis shows no active passphrase, session,
login, owner-identity, or Settings imports; local owner mode works with only
database/Storage configuration plus the mode setting; production/read-only
mutation tests pass; and all existing live read/manual behavior remains.

**No-go if:** removing auth leaves a mutation without a mode guard, a stale UI
path promises a login that no longer exists, or the cleanup changes the PDF,
OCR, retrieval, or database access behavior.

### Phase D — Deployment cutover, acceptance, and handoff

**Objective:** Validate the two environments against the real source and make
the operating procedure unambiguous.

#### Documentation and configuration areas

Update:

- `.env.example`
- `README.md`
- `docs/LOCAL_DEVELOPMENT.md`
- `docs/MOTOMEMORY_CONOPS.md` Phase 4 section
- `docs/PHASE_4_COMPLETION_HANDOFF.md`

Create or update an operator checklist covering local mode, deployed mode,
Storage, database connectivity, OCR prerequisites, and read-only acceptance.

#### Phase D go/no-go

**Go only if:** the owner completes the connected acceptance walkthrough in
Section 7 and deployment configuration has been checked. The release is ready
when guests can see live data and every mutation is rejected in the deployed
environment.

**Conditional go:** if connected browser E2E cannot bind in the execution
environment, unit/integration/build checks may pass but real local/deployed
acceptance remains explicitly pending.

## 5. Data, credentials, and security boundary

The deployed server still needs server-side credentials to read the live
source:

- `DATABASE_URL` for PostgreSQL.
- `SUPABASE_PROJECT_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the private PDF
  Storage route.
- `SUPABASE_STORAGE_BUCKET` for the manual object.

These values must remain server-only. They must never be prefixed with
`NEXT_PUBLIC_`, embedded in client bundles, returned in DTOs, logged, or placed
in the repository. The browser sees only allowlisted read DTOs and controlled
PDF responses.

Read-only mode protects the application mutation routes; it does not turn the
deployed server credentials into read-only database credentials. A compromise
of the deployed server or its service-role key could still reach the underlying
systems according to those credentials. As future hardening, consider a
separate read-only PostgreSQL credential and a narrowly scoped Storage access
credential for the deployed environment. That is not required for this phase,
and local owner mode must retain the credentials needed for OCR/upload writes.

The public rate limiter from migration 009 remains necessary. It limits search,
retrieval-question, and PDF abuse but is not an owner authorization mechanism.
The mode guard is the authorization mechanism for writes.

## 6. Test strategy

### Unit tests

Add a focused runtime-mode test, for example:

- `tests/unit/runtime-mode.test.ts`
- `tests/unit/mutation-guard.test.ts`

Cover:

- explicit local `owner` mode;
- explicit `readonly` mode;
- omitted mode defaults to `readonly`;
- malformed mode defaults to `readonly`;
- `owner` is forced to `readonly` in production;
- mode cannot be changed by headers, query parameters, cookies, or request
  bodies;
- the read-only error has a stable code/status/message shape.

Remove or replace passphrase/session unit tests after Phase C. Keep public rate
limit tests and domain/manual/OCR tests.

### Integration tests

Extend route tests to run each mutation in both modes. In read-only mode,
assert all of the following:

- response status is `403`;
- the route guard runs before the repository/Storage/OCR mock;
- no database mutation transaction begins;
- no Storage upload/delete occurs;
- no manual ingestion worker starts;
- the response does not reveal credentials or internal configuration.

Preserve tests proving that guest reads work without owner configuration:

- motorcycle overview;
- maintenance records/outlook;
- manual metadata/facts;
- PDF `HEAD`/`GET`/range behavior;
- manual search;
- retrieval-only questions;
- public rate-limit enforcement.

Keep domain tests for mileage validation, service record validation, manual
deduplication, page provenance, OCR persistence, fact correction, and answer
retrieval unchanged unless imports must be updated.

### End-to-end tests

Add or update E2E coverage for two explicit server configurations:

**Local owner run**

- `MOTOMEMORY_RUNTIME_MODE=owner`.
- Open `/` and `/manual` directly.
- Change mileage.
- Create/edit/delete an individual service record.
- Upload/retry manual ingestion where test fixtures are configured.
- Correct a manual fact.
- Confirm no login or passphrase page appears.

**Deployed read-only run**

- `MOTOMEMORY_RUNTIME_MODE=readonly` or omitted.
- Open `/` and `/manual` without credentials.
- Confirm live values, manual PDF, search, questions, and source links work.
- Confirm UI is read-only.
- Directly call every mutation route and assert `403`.
- Verify the database, Storage, OCR status, and facts are unchanged.
- After a local owner change, refresh the deployed view and confirm the new
  value is visible.

Run the repository checks:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
git diff --check
```

## 7. Connected operator acceptance walkthrough

Use the real Supabase project and the real manual, without putting the PDF or
secrets in Git:

1. Confirm the local `.env.local` contains `MOTOMEMORY_RUNTIME_MODE=owner`,
   `DATABASE_URL`, and the required Supabase Storage values.
2. Run `npm run dev` and open `/`.
3. Change the motorcycle mileage and verify the dashboard updates.
4. Add, edit, and delete one test service record, or use an intentional real
   record if no test data is available.
5. Open `/manual`, verify the PDF viewer/search/question flow, and confirm the
   owner-only upload/OCR/fact controls are available locally.
6. Deploy with `MOTOMEMORY_RUNTIME_MODE=readonly` or with the variable omitted.
7. Open the deployed `/` and `/manual` in a clean browser with no account or
   session. Confirm the same live data and PDF are visible.
8. Confirm deployed search, retrieval-only questions, source links, and public
   rate limits behave normally.
9. Attempt mileage, service, manual upload, OCR ingestion/retry, and fact
   correction through both the UI and direct HTTP requests. Every attempt must
   be rejected and must leave the database, Storage, OCR state, and facts
   unchanged.
10. Make one harmless local owner edit, refresh the deployed page, and confirm
    it appears without a deployment or publish step.
11. Confirm browser developer tools show no database URL, service-role key,
    Storage object key, mode secret, or private connection string.

## 8. Rollback and recovery

### Before cutover

- Keep the current branch/commit available until local owner mode and deployed
  read-only acceptance both pass.
- Do not remove applied SQL migrations.
- Keep a database backup or provider recovery point before any schema-affecting
  operation, even though this change should not require a new schema migration.

### Application rollback

If the new runtime-mode release has a defect, redeploy the previous known-good
application revision. Existing database and Storage data remain compatible;
the mode change is application configuration and does not migrate domain data.

### Configuration recovery

- If local edits are accidentally disabled, set
  `MOTOMEMORY_RUNTIME_MODE=owner` only in the private local `.env.local` and
  restart `npm run dev`.
- If the deployed app accidentally permits writes, immediately remove the
  variable or set `MOTOMEMORY_RUNTIME_MODE=readonly`, redeploy/restart, and
  verify direct mutation requests return `403`.
- If the deployed app cannot read, verify `DATABASE_URL`, Supabase project URL,
  service-role key, bucket name, network access, and server logs without
  exposing credentials to the browser.
- If the manual is unavailable, verify the existing private Storage object and
  Storage configuration; do not copy the PDF into the repository.

## 9. Operator setup checklist

### Local owner machine

- [ ] Node.js 20.9+ and npm are installed.
- [ ] Poppler and Tesseract are installed for scanned-manual ingestion.
- [ ] `.env.local` contains `MOTOMEMORY_RUNTIME_MODE=owner`.
- [ ] `.env.local` contains the server-only `DATABASE_URL`.
- [ ] `.env.local` contains the Supabase project URL, service-role key, and
      manual Storage bucket.
- [ ] Public rate-limit configuration is present as appropriate for local
      testing.
- [ ] No passphrase, Supabase Auth, or Google OAuth setup is required.
- [ ] `npm run dev` starts successfully.
- [ ] Owner edits are made at `http://localhost:3000`, not at the deployment.

### Deployed application

- [ ] `MOTOMEMORY_RUNTIME_MODE=readonly` is set, or the variable is omitted.
- [ ] Production cannot honor `owner` mode.
- [ ] `DATABASE_URL` is configured as a server-only deployment secret.
- [ ] Supabase project URL, service-role key, and Storage bucket are configured
      as server-only deployment secrets.
- [ ] Migration 009 is applied.
- [ ] Migrations 001–010 are retained as applied history; migration 010 is
      dormant and is not queried by the application.
- [ ] The public deployed origin and trusted client-IP behavior are configured
      for the public rate limiter.
- [ ] `/` and `/manual` work without an account.
- [ ] Direct mutation requests return `403` and do not change data.
- [ ] No server credential appears in browser source, network responses, or
      client environment variables.

## 10. Completion criteria

Phase 4 is complete when:

1. Local `owner` mode enables the existing editing workflows without any
   passphrase or login.
2. Deployed `readonly` mode is the safe default and rejects every mutation at
   the server boundary.
3. Guests can view live motorcycle data, the manual PDF, OCR evidence, search,
   retrieval-only questions, and maintenance history.
4. Local changes use the same Supabase database/Storage and appear in deployed
   reads after refresh.
5. Passphrase/session/login code and Settings UX are removed from the active
   application.
6. Applied migrations are preserved, migration 009 remains active, and
   migration 010 is left dormant without application dependencies.
7. Automated validation passes and the connected operator walkthrough is
   recorded as passed or explicitly pending.

## 11. Phase D acceptance record

Phase D completed the deployment cutover audit for the runtime-mode release.
The mutation inventory contains only the intended state-changing routes:

| Surface | Result |
|---|---|
| Mileage `PATCH` | Guarded before request parsing and repository work |
| Service-record `POST`, `PATCH`, `DELETE` | Guarded before validation/repository work |
| Manual upload `POST` | Guarded before form parsing, Storage, or database work |
| OCR start/retry `POST` | Guarded before ingestion worker or persistence work |
| Fact correction `PATCH` | Guarded before correction persistence |
| Manual search/question `POST` | Remain read-oriented and retain public rate limits |
| PDF `GET`/`HEAD` | Remain read-oriented and retain the public PDF rate limit |

The final checkout passed:

- `npm run test:unit` — 124 tests passed.
- `npm run test:integration` — 56 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `git diff --check` — passed.

`npm run test:e2e` could not start its configured Next.js web server in the
execution sandbox. A standalone development process reported ready but was
not reachable from the Playwright process; Playwright exited before running
browser tests. This is an environment limitation, not a passing connected
acceptance result. Run the E2E and connected operator walkthrough on the
owner’s machine or deployment target before public cutover.

No migration is required for the runtime-mode switch. Applied migrations
`001`–`010` were not modified; migration `009` remains the active public
rate-limit schema and migration `010` remains dormant historical schema.
