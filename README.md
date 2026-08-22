# MotoMemory

MotoMemory is a personal motorcycle maintenance companion for a 1981 Suzuki GS750. Phase 1 is a local Next.js application backed by a private Supabase PostgreSQL database.

The current Phase 1 state is intentionally small:

- One motorcycle: 1981 Suzuki GS750.
- Initial mileage: 18,501 mi.
- Provisional maintenance cadence: one general check every 1,000 mi.
- Temporary motorcycle visual: 🏍️.
- Manual mileage updates, including lower corrections.
- No account, user profile, authentication, mobile client, GPS, manual ingestion, or AI.

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

Apply the versioned migrations in order using the Supabase SQL Editor or Supabase CLI:

```text
supabase/migrations/001_phase1_schema.sql
supabase/migrations/002_phase1_seed.sql
supabase/migrations/003_phase1_mileage_function.sql
```

Then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If `DATABASE_URL` is absent or the migrations have not been applied, the app shows an explicit disconnected state instead of fabricating motorcycle data.

More environment and database guidance is in [docs/LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md).

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
| `npm test` | Run unit, integration, and browser tests |

## Phase 1 behavior

At 18,501 mi, the provisional next target is 19,000 mi with 499 mi remaining. An exact target is shown as due. Without maintenance history, Phase 1 does not claim that a task is overdue. The schedule is labeled provisional and will be replaced with manual-backed definitions in Phase 2.

Mileage is validated at the API boundary, accepts zero and lower corrections, supports up to two decimal places, and never silently rounds invalid precision. A stale page cannot overwrite a newer persisted value without refreshing first.

## Security and scope boundary

The browser talks to Next.js route handlers; PostgreSQL credentials stay server-side. Phase 1 intentionally does not enable authentication or RLS because the app is private and tailored to one owner. Authentication, RLS, and an explicit owner/demo scope are required before public deployment or a Vercel-hosted demo.

The 🏍️ placeholder is intentional. The final motorcycle image and frontend visual system will be defined in a later design document.
