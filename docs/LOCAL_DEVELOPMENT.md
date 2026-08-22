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

| Variable | Exposure | Phase 1 use |
| --- | --- | --- |
| `DATABASE_URL` | Server-only secret | Private Supabase PostgreSQL connection string used by the server repository |
| `SUPABASE_PROJECT_URL` | Non-secret, but server configuration for now | Optional project URL reserved for future platform integrations |

Do not add a `NEXT_PUBLIC_` prefix to database credentials. The browser must not connect directly to the database. Phase 1 does not require a service-role key, Supabase client SDK, or migration credentials in the repository.

## Manual Supabase step

The owner must create a private Supabase project and copy its server-side PostgreSQL connection string into the local `.env.local` file. Credentials are intentionally absent from this environment and are not fabricated here.

After setting `DATABASE_URL`, apply the versioned migrations from the repository in order using the Supabase SQL Editor or the Supabase CLI:

```text
supabase/migrations/001_phase1_schema.sql
supabase/migrations/002_phase1_seed.sql
supabase/migrations/003_phase1_mileage_function.sql
```

The seed is intentionally idempotent and does not overwrite a manually corrected mileage value. Phase 1 does not enable RLS or authentication because the app is private and database access is server-side only. RLS, authentication, and an explicit owner/demo data scope are required before public deployment.

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
