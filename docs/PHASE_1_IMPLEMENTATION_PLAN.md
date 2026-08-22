# MotoMemory Phase 1 — Implementation Plan

This plan turns the [Phase 1 CONOPS](./PHASE_1_CONOPS.md) into an executable build sequence. It covers the first local Next.js application, its Supabase/PostgreSQL persistence, the single-motorcycle main view, manual mileage updates, and the provisional 1,000-mile maintenance outlook.

The plan intentionally does not define the final visual design. It uses accessible, neutral presentation with the 🏍️ placeholder until the separate frontend design document is written.

## Table of Contents

- [Plan Summary](#plan-summary)
- [Goals and Boundaries](#goals-and-boundaries)
- [Technical Baseline](#technical-baseline)
- [Implementation Phases](#implementation-phases)
  - [Phase 0: Local Project and Service Setup](#phase-0-local-project-and-service-setup)
  - [Phase 1: Next.js Application Foundation](#phase-1-nextjs-application-foundation)
  - [Phase 2: Supabase PostgreSQL Schema](#phase-2-supabase-postgresql-schema)
  - [Phase 3: Domain Logic and Server Boundary](#phase-3-domain-logic-and-server-boundary)
  - [Phase 4: Motorcycle Main View](#phase-4-motorcycle-main-view)
  - [Phase 5: Error Handling and Hardening](#phase-5-error-handling-and-hardening)
  - [Phase 6: Verification and Handoff](#phase-6-verification-and-handoff)
- [Database Implementation Plan](#database-implementation-plan)
- [Application Behavior](#application-behavior)
- [Testing and Verification](#testing-and-verification)
- [Risks and Mitigations](#risks-and-mitigations)
- [Definition of Done](#definition-of-done)
- [Deferred Work](#deferred-work)

## Plan Summary

| Decision | Phase 1 choice |
|---|---|
| Web framework | Next.js App Router with TypeScript |
| Database platform | Supabase |
| Database engine | PostgreSQL |
| Runtime | Next.js application running locally |
| Data scope | One fixed motorcycle: 1981 Suzuki GS750 |
| Initial mileage | 18,501 mi |
| Mileage updates | Manual; any valid non-negative value is accepted |
| Provisional maintenance cadence | One general maintenance check every 1,000 mi |
| Initial visual | 🏍️ emoji placeholder |
| Authentication | None |
| Future hosting | Likely Vercel; not part of Phase 1 implementation |

The build should leave a clean boundary between the browser, the Next.js server, the domain calculations, and PostgreSQL:

```text
Browser
  │
  │ page load / mileage update
  ▼
Next.js server
  ├── Motorcycle repository
  ├── Mileage validation
  └── Maintenance calculation
        │
        ▼
Supabase PostgreSQL
  ├── motorcycle state
  ├── maintenance definitions
  └── mileage updates
```

The browser never receives a database password or privileged Supabase credential. All database access stays on the server side of the local Next.js application.

## Goals and Boundaries

### Goals

- Start the app locally and reach the motorcycle main view without account setup.
- Load the seeded GS750 state from Supabase PostgreSQL.
- Show 18,501 mi as the initial current mileage.
- Show the next provisional maintenance target at 19,000 mi with 499 mi remaining.
- Allow the owner to set any valid non-negative mileage.
- Persist accepted mileage and record the update origin and timestamp.
- Recalculate the maintenance outlook after every accepted mileage change.
- Handle loading, empty, invalid, and persistence-failure states clearly.
- Establish a data boundary that later mobile and service-history phases can reuse.

### Boundaries

The plan does not include:

- User accounts, authentication, authorization UX, or multiple motorcycles.
- Public hosting, Vercel configuration, or a public demo.
- Final typography, color palette, spacing system, responsive layout, or polished branding.
- A motorcycle image or 3D model beyond the 🏍️ placeholder.
- Service records, completed-maintenance state, parts, notes, or costs.
- Service manual upload, PDF processing, embeddings, RAG, or AI answers.
- Mobile development, GPS, ride sessions, or background location.

## Technical Baseline

### Project structure

The repository currently contains documentation only. Phase 1 initializes the application in the repository root and establishes these boundaries:

```text
app/
  page.tsx                         # main motorcycle view
  loading.tsx                      # page loading state
  error.tsx                        # recoverable page error state
  api/
    motorcycle/route.ts            # read-only overview endpoint
    motorcycle/mileage/route.ts    # mileage update endpoint

components/
  motorcycle-main-view.tsx
  mileage-form.tsx
  maintenance-outlook.tsx
  state-feedback.tsx

lib/
  domain/
    mileage.ts                     # input validation and update rules
    maintenance.ts                 # provisional mileage calculations
    types.ts                       # shared domain types
  data/
    motorcycle-repository.ts       # server-side PostgreSQL access
  supabase/
    storage.ts                     # reserved for later file storage work

supabase/
  migrations/
    001_phase1_schema.sql
    002_phase1_seed.sql
    003_phase1_mileage_function.sql

tests/
  unit/
  integration/
  e2e/
```

The exact filenames can change during implementation, but the separation of UI, domain logic, data access, and migrations should remain.

### Runtime and dependency choices

- Next.js App Router and TypeScript provide the web application foundation.
- A server-side PostgreSQL driver provides direct SQL access through the persistence adapter. Phase 1 does not introduce an ORM so the PostgreSQL schema, queries, constraints, and transactions remain visible while the database is being learned.
- Zod or an equivalent runtime validator validates request payloads at the server boundary. TypeScript types alone do not validate browser input at runtime.
- Vitest or an equivalent unit-test runner covers pure mileage and maintenance calculations.
- Playwright or an equivalent browser runner covers the main user journey after the local app and database are available.
- Supabase CLI migrations or the Supabase SQL editor manage schema changes. Migrations remain the source of truth; dashboard edits do not become undocumented production state.

### Secrets and access

- Store the Supabase/PostgreSQL connection string in a local environment file excluded from version control.
- Keep all database credentials server-only.
- Do not import database credentials into client components.
- Do not expose the Supabase service-role credential to the browser.
- Keep the local app private because Phase 1 intentionally has no authentication.
- Defer public bucket configuration and manual-file storage until Phase 2.

## Implementation Phases

### Phase 0: Local Project and Service Setup

**Objective:** Prepare the local development environment and the private Supabase project without building product behavior yet.

**Work:**

1. Initialize the Next.js App Router application with TypeScript and linting.
2. Confirm the supported local Node.js runtime and package manager.
3. Create a private Supabase project.
4. Record the project connection details in a local environment file.
5. Add an `.env.example` containing variable names but no secrets.
6. Add the environment file and local database artifacts to `.gitignore`.
7. Add the basic scripts for development, linting, type checking, building, and testing.
8. Confirm that the empty application starts locally.

**Deliverables:**

- A bootable Next.js project.
- A private Supabase project.
- Documented local environment variables.
- No credentials committed to the repository.

**Gate:** The local Next.js starter page loads, the project can run its validation scripts, and the application can read a non-secret Supabase configuration value without exposing credentials to the browser.

### Phase 1: Next.js Application Foundation

**Objective:** Establish the application boundaries before connecting the main view to real data.

**Work:**

1. Create the root page route for the motorcycle view.
2. Add loading and recoverable error boundaries.
3. Add domain type definitions for motorcycle state, maintenance definitions, mileage updates, and derived outlook items.
4. Add a server-only data-access boundary with a placeholder repository method.
5. Add a simple server health or configuration check that does not expose secrets.
6. Add neutral page structure and accessible controls without committing to the final frontend design.

**Deliverables:**

- The app has a stable main route.
- UI code does not contain raw SQL.
- Domain calculations are not embedded inside JSX.
- Loading and error behavior have dedicated states.

**Gate:** The page renders a safe empty/loading state without a database, and the project passes type checking and linting.

### Phase 2: Supabase PostgreSQL Schema

**Objective:** Create the smallest durable schema for one motorcycle and its manual mileage updates.

**Work:**

1. Create the `motorcycle_state` table with the fixed `gs750` identifier.
2. Create the `maintenance_definitions` table with a foreign key to the motorcycle.
3. Create the `mileage_updates` table with a foreign key to the motorcycle.
4. Add primary keys, foreign keys, non-negative mileage checks, valid interval checks, and timestamp defaults.
5. Add the indexes needed by the single-motorcycle overview and update history.
6. Seed the 1981 Suzuki GS750 state.
7. Seed current mileage at 18,501 mi.
8. Seed a provisional `General maintenance check` at a 1,000-mile interval and 1,000-mile upcoming window.
9. Create a transactional PostgreSQL function for accepted mileage updates.
10. Run the migration and seed against the private Supabase project.

**Deliverables:**

- Versioned SQL migrations.
- One seeded `gs750` motorcycle row.
- One seeded provisional maintenance definition.
- A database function that updates current mileage and records a mileage event atomically.

**Gate:** A SQL-level verification can read the seeded state, calculate the expected 19,000-mile target, and update the mileage without creating duplicate or partial records.

### Phase 3: Domain Logic and Server Boundary

**Objective:** Make mileage validation, maintenance calculation, and database persistence deterministic and independently testable.

**Work:**

1. Implement runtime mileage validation:
   - Accept numeric values supported by the chosen precision.
   - Accept zero and any positive value.
   - Accept values lower than the current mileage.
   - Reject empty, non-numeric, negative, and unsupported-precision values.
2. Implement the provisional maintenance calculation.
3. Implement the server-side repository for reading the motorcycle overview.
4. Implement the server-side repository for calling the mileage update transaction.
5. Define stable API response and error shapes.
6. Add `GET /api/motorcycle` for the future mobile client and browser integration.
7. Add `PATCH /api/motorcycle/mileage` for manual updates.
8. Ensure repeated submission of the current value is a no-op rather than a duplicate mileage event.
9. Ensure a failed update leaves the previous persisted state authoritative.

**Deliverables:**

- Pure mileage validation functions.
- Pure maintenance calculation functions.
- Server-only PostgreSQL repository.
- Read endpoint for the motorcycle overview.
- Mileage update endpoint.
- Consistent error responses.

**Gate:** Unit and integration tests prove that valid values persist, invalid values do not write, lower values are accepted, repeated values do not create duplicate events, and the derived outlook changes after a successful update.

### Phase 4: Motorcycle Main View

**Objective:** Connect the owner-facing page to real Supabase data and complete the basic workflow.

**Work:**

1. Load the single motorcycle overview on the main route.
2. Show the fixed identity: 1981 Suzuki GS750.
3. Show the 🏍️ visual placeholder.
4. Show current mileage and last update information.
5. Show the provisional maintenance check and its calculation basis.
6. Show the initial 18,501 mi state as 19,000 mi next target and 499 mi remaining.
7. Add the mileage form to the main view.
8. Show pending, saved, rejected, and failed update feedback.
9. Refresh the displayed motorcycle state after a successful update.
10. Keep the page usable when the visual asset remains only an emoji.
11. Keep layout and styling intentionally neutral until the frontend design document exists.

**Deliverables:**

- Working local motorcycle main view.
- Working manual mileage update flow.
- Working provisional maintenance outlook.
- Accessible labels and keyboard-operable controls.

**Gate:** Starting from a fresh local session, the owner can open the page, see the seeded GS750 state, set a new mileage, and see the updated persisted value and recalculated outlook without navigating away.

### Phase 5: Error Handling and Hardening

**Objective:** Make the personal local application predictable when data, configuration, or the Supabase connection is unavailable.

**Work:**

1. Add explicit empty-state behavior if the `gs750` row is missing.
2. Add explicit schedule-unavailable behavior if no active maintenance definition exists.
3. Add clear database connection and query failure messages.
4. Prevent unsaved form values from being displayed as authoritative current mileage.
5. Disable duplicate submissions while an update is pending.
6. Handle a stale page submitting an older value without silently overwriting a newer state. The initial implementation can surface a conflict and ask for refresh.
7. Confirm that server-only environment values are not included in rendered HTML or client bundles.
8. Confirm that the local app has no public or anonymous write path.
9. Add database seed/reset instructions for local development without using destructive commands against the personal hosted project.

**Deliverables:**

- Recoverable empty and error states.
- Safe update behavior under retries and stale pages.
- Security check for secrets and browser access.
- Repeatable development reset procedure.

**Gate:** Disconnecting or misconfiguring the database produces a clear unavailable state, and no failed request reports a durable success.

### Phase 6: Verification and Handoff

**Objective:** Prove the Phase 1 acceptance criteria and leave the project ready for continued development.

**Work:**

1. Run unit tests for mileage validation and maintenance calculations.
2. Run integration tests against a test database or isolated Supabase environment.
3. Run the browser journey against the local Next.js app.
4. Verify persistence across refreshes and application restarts.
5. Verify lower-mileage correction behavior.
6. Verify the seeded 18,501 mi and 19,000 mi / 499 mi calculation.
7. Run linting, type checking, and a production build.
8. Review the user-visible error and loading states.
9. Update the project README with local startup, Supabase setup, migration, and test instructions.
10. Record any implementation deviations from the CONOPS before beginning Phase 2.

**Deliverables:**

- Passing verification results.
- Local setup documentation.
- Database migration and seed instructions.
- A Phase 1 completion note identifying deferred work.

**Gate:** The Definition of Done is complete and the Phase 1 acceptance matrix passes. The project owner can start the app from a clean checkout with the required local environment and operate the motorcycle view without manual database edits.

## Database Implementation Plan

### Tables

The implementation uses three Phase 1 tables. Derived maintenance outlook values are calculated at read time and are not persisted.

```text
motorcycle_state
  id: text primary key                   # gs750
  make: text not null                    # Suzuki
  model: text not null                   # GS750
  model_year: smallint not null          # 1981
  current_mileage: numeric not null      # 18501 initially
  mileage_unit: text not null             # mi
  visual_state: text not null             # emoji
  visual_emoji: text not null             # 🏍️
  last_mileage_update_at: timestamptz
  last_mileage_update_origin: text        # manual
  updated_at: timestamptz not null

maintenance_definitions
  id: uuid primary key
  motorcycle_id: text references motorcycle_state(id)
  name: text not null                    # General maintenance check
  interval_miles: numeric not null       # 1000
  due_window_miles: numeric not null      # 1000
  status: text not null                  # active
  source: text not null                  # phase1_configured
  notes: text

mileage_updates
  id: uuid primary key
  motorcycle_id: text references motorcycle_state(id)
  previous_mileage: numeric not null
  accepted_mileage: numeric not null
  recorded_at: timestamptz not null
  origin: text not null                  # manual
```

### Constraints and indexes

- `current_mileage >= 0`.
- `previous_mileage >= 0`.
- `accepted_mileage >= 0`.
- `interval_miles > 0`.
- `due_window_miles >= 0`.
- `motorcycle_state.id` ensures one stable lookup for the Phase 1 motorcycle.
- `maintenance_definitions(motorcycle_id, status)` supports active schedule reads.
- `mileage_updates(motorcycle_id, recorded_at desc)` supports latest-update and diagnostic views.
- A uniqueness rule on `(motorcycle_id, name)` prevents duplicate copies of the provisional maintenance definition.

### Transactional mileage update

Mileage updates should be handled as one database transaction:

1. Lock the `gs750` row for the update.
2. Read the current mileage.
3. Validate the new non-negative value.
4. If the value is unchanged, return the current state without inserting an event.
5. Update `motorcycle_state.current_mileage` and timestamps.
6. Insert one `mileage_updates` row.
7. Commit both changes together.

If any step fails, the current state and update log remain unchanged. The server returns an error instead of showing a successful update.

### Supabase operating boundary

- Supabase hosts PostgreSQL for Phase 1.
- The Next.js server connects to PostgreSQL through a server-only connection.
- The browser does not query Supabase tables directly.
- Supabase Storage is reserved for the future manual PDF and motorcycle image.
- Supabase Auth, Realtime, Edge Functions, and `pgvector` remain deferred until a later phase needs them.
- SQL migrations remain versioned in the repository.

## Application Behavior

### Main read

The main page requests one overview containing:

```text
motorcycle
  id
  make
  model
  model_year
  current_mileage
  mileage_unit
  visual_state
  visual_emoji
  last_mileage_update_at

maintenance_outlook[]
  definition_id
  name
  interval_miles
  due_mileage
  remaining_miles
  status
  source
```

The page does not calculate values independently from the API/domain layer. This prevents the browser and future mobile client from implementing slightly different maintenance rules.

### Provisional mileage calculation

For the Phase 1 interval of 1,000 mi:

```text
next_due = max(interval_miles, ceil(current_mileage / interval_miles) * interval_miles)
remaining = next_due - current_mileage
```

Examples:

| Current mileage | Next target | Remaining | Phase 1 status |
|---:|---:|---:|---|
| 18,501 | 19,000 | 499 | Upcoming |
| 18,999 | 19,000 | 1 | Upcoming |
| 19,000 | 19,000 | 0 | Due |
| 19,001 | 20,000 | 999 | Upcoming |
| 0 | 1,000 | 1,000 | Upcoming |

Phase 1 does not claim a maintenance item is overdue because it does not yet record whether the previous maintenance was completed. Phase 3 can add last-service mileage and make overdue calculations meaningful.

### Mileage update behavior

The update request accepts:

- Whole-mile values or the supported decimal precision.
- Values greater than, equal to, or lower than the current value.
- Zero or positive values.

The update request rejects:

- Empty values.
- Non-numeric values.
- Negative values.
- Values with unsupported precision.
- Requests that cannot be persisted.

A successful response returns the updated motorcycle overview. The UI uses that response as the new authoritative state.

### Error contract

Use a consistent error shape:

```json
{
  "error": {
    "code": "INVALID_MILEAGE",
    "message": "Mileage must be zero or greater."
  }
}
```

Initial error codes:

- `MOTORCYCLE_NOT_FOUND`
- `INVALID_MILEAGE`
- `INVALID_CONFIGURATION`
- `DATABASE_UNAVAILABLE`
- `UPDATE_FAILED`
- `STALE_STATE`

The browser displays useful messages but does not expose database connection details, SQL errors, credentials, or stack traces.

## Testing and Verification

### Unit tests

Test pure domain behavior without a database:

- Numeric mileage is accepted.
- Empty, text, negative, and unsupported-precision inputs are rejected.
- Lower mileage is accepted and treated as a manual setting.
- 18,501 mi produces a 19,000 mi target and 499 mi remaining.
- Exact target mileage produces `due`.
- Missing or invalid interval produces `unknown`.
- A missing current mileage produces `unknown` rather than a fabricated result.
- The calculation does not claim `overdue` without service-history data.

### Database and integration tests

Verify the persistence boundary:

- Seed creates exactly one `gs750` motorcycle row.
- Seed creates the provisional 1,000-mile maintenance definition.
- A valid update changes current state and inserts one mileage event.
- A same-value update does not create a duplicate event.
- A lower-value update changes state and records the manual origin.
- A negative or malformed value makes no database change.
- A failed transaction leaves both current state and mileage updates unchanged.
- The overview query returns the same derived result as the domain calculation.

Use a local Supabase test stack or an isolated test project. Never reset or seed the personal hosted project as part of an automated test command.

### Browser acceptance tests

Verify the owner journey:

1. Start the local application.
2. Open the main page.
3. Confirm the 1981 Suzuki GS750 and 🏍️ placeholder are visible.
4. Confirm 18,501 mi is visible.
5. Confirm the 19,000 mi target and 499 mi remaining are visible.
6. Enter a higher mileage and save it.
7. Confirm the updated mileage and maintenance outlook.
8. Refresh the page and confirm persistence.
9. Enter a lower valid mileage and confirm it saves.
10. Enter an invalid value and confirm the prior state remains unchanged.
11. Simulate database unavailability and confirm the page presents a recoverable error.

### Static verification

Before handoff, run:

- Formatting check if configured.
- Linting.
- Type checking.
- Unit tests.
- Integration tests.
- Browser acceptance tests.
- Production build.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The provisional 1,000-mile cadence does not reflect the real manual. | The first outlook could be mistaken for authoritative motorcycle guidance. | Label the cadence as provisional and replace it with manual-derived definitions in Phase 2. |
| No service history exists in Phase 1. | The app cannot reliably determine whether an item is overdue. | Show next scheduled mileage and due status only; defer overdue logic to Phase 3. |
| Supabase credentials reach the browser. | The database could be exposed or modified outside the intended flow. | Keep credentials server-only and inspect the client build for accidental exposure. |
| Remote Supabase access fails during local development. | The main view cannot load or save state. | Provide clear unavailable states and document the local environment; do not fall back silently to localStorage. |
| A later phase needs a different schema scope. | Migration to users, demos, or multiple bikes becomes difficult. | Keep the stable `gs750` identifier and add explicit scope relationships later. |
| Styling work expands before the behavior is proven. | Phase 1 completion is delayed by decisions that belong to frontend design. | Use neutral accessible presentation and keep visual treatment limited to the 🏍️ placeholder. |
| Direct SQL grows without a boundary. | Database details spread through UI code and become hard to change. | Keep SQL in migrations/repository code and expose typed domain functions to the application. |

## Definition of Done

Phase 1 is complete when all of the following are true:

- The local Next.js app starts from documented instructions.
- The app reads the seeded GS750 state from Supabase PostgreSQL.
- The main view shows the fixed bike identity, 🏍️ placeholder, current mileage, and maintenance outlook.
- The initial state is 18,501 mi with a 19,000 mi target and 499 mi remaining.
- The owner can save any valid non-negative mileage, including a lower correction.
- Invalid mileage never replaces the last valid persisted state.
- Accepted updates survive refreshes and application restarts.
- Same-value submissions do not create duplicate mileage events.
- The provisional schedule is visibly labeled as provisional.
- The UI presents loading, empty, save-pending, save-success, validation-error, and persistence-error states.
- No user account, authentication flow, mobile client, GPS, AI, manual upload, or service-history feature has been introduced accidentally.
- SQL migrations, seed instructions, environment setup, and tests are documented.
- Linting, type checking, tests, and production build pass.
- Any deviation from the Phase 1 CONOPS is recorded before Phase 2 begins.

## Deferred Work

The following work remains intentionally outside this plan:

- Replace the 🏍️ placeholder with the selected motorcycle image and final visual treatment.
- Deploy the Next.js app publicly, likely through Vercel.
- Add authentication or a multi-user data scope.
- Upload and ingest the service manual.
- Store manual chunks, embeddings, citations, and extracted maintenance facts.
- Add maintenance history and overdue calculations based on last service.
- Build the Expo mobile client.
- Add GPS ride tracking and automatic mileage updates.

