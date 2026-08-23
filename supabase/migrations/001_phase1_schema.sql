-- MotoMemory Phase 1 schema.
--
-- This database is intentionally private and server-only during Phase 1.
-- Authentication and RLS must be designed before any public deployment.

create extension if not exists pgcrypto;

create table if not exists public.motorcycle_state (
  id text primary key,
  make text not null,
  model text not null,
  model_year smallint not null check (model_year between 1885 and 2200),
  current_mileage numeric not null check (current_mileage >= 0),
  mileage_unit text not null default 'mi' check (mileage_unit = 'mi'),
  visual_state text not null default 'emoji' check (visual_state in ('emoji', 'image')),
  visual_emoji text,
  last_mileage_update_at timestamptz,
  last_mileage_update_origin text check (last_mileage_update_origin is null or last_mileage_update_origin = 'manual'),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_definitions (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id text not null references public.motorcycle_state(id) on delete cascade,
  name text not null,
  interval_miles numeric not null check (interval_miles > 0),
  due_window_miles numeric not null default 0 check (due_window_miles >= 0),
  status text not null default 'active' check (status in ('active', 'disabled')),
  source text not null,
  notes text,
  unique (motorcycle_id, name)
);

create table if not exists public.mileage_updates (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id text not null references public.motorcycle_state(id) on delete cascade,
  previous_mileage numeric not null check (previous_mileage >= 0),
  accepted_mileage numeric not null check (accepted_mileage >= 0),
  recorded_at timestamptz not null default now(),
  origin text not null default 'manual' check (origin = 'manual')
);

create index if not exists maintenance_definitions_motorcycle_status_idx
  on public.maintenance_definitions (motorcycle_id, status);

create index if not exists mileage_updates_motorcycle_recorded_at_idx
  on public.mileage_updates (motorcycle_id, recorded_at desc);
