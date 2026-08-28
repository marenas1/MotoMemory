-- MotoMemory Phase 4 identity and immutable public showcase projection.
--
-- This migration is additive after 001 through 007. The private motorcycle,
-- manual, OCR, fact, mileage, and service-history tables remain authoritative.
-- Auth users and private source data are never seeded here.

create extension if not exists pgcrypto;

create table if not exists public.owner_scopes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('private_owner', 'public_showcase')),
  motorcycle_id text not null references public.motorcycle_state(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (kind, motorcycle_id),
  unique (id, motorcycle_id)
);

create table if not exists public.owner_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_subject uuid not null unique,
  role text not null default 'owner' check (role = 'owner'),
  private_scope_id uuid not null unique references public.owner_scopes(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists owner_scopes_id_motorcycle_uidx
  on public.owner_scopes (id, motorcycle_id);

create index if not exists owner_accounts_private_scope_idx
  on public.owner_accounts (private_scope_id);

create index if not exists owner_scopes_motorcycle_kind_idx
  on public.owner_scopes (motorcycle_id, kind);

-- The motorcycle_id column is intentionally redundant. Composite foreign keys
-- make it impossible to pair scopes belonging to different motorcycles.
create table if not exists public.showcase_projections (
  id uuid primary key default gen_random_uuid(),
  private_scope_id uuid not null unique references public.owner_scopes(id) on delete restrict,
  public_scope_id uuid not null unique references public.owner_scopes(id) on delete restrict,
  motorcycle_id text not null references public.motorcycle_state(id) on delete restrict,
  enabled boolean not null default false,
  manual_visible boolean not null default false,
  current_snapshot_id uuid,
  revision bigint not null default 0 check (revision >= 0),
  last_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (private_scope_id, motorcycle_id),
  foreign key (private_scope_id, motorcycle_id)
    references public.owner_scopes(id, motorcycle_id)
    on delete restrict,
  foreign key (public_scope_id, motorcycle_id)
    references public.owner_scopes(id, motorcycle_id)
    on delete restrict
);

create index if not exists showcase_projections_enabled_idx
  on public.showcase_projections (private_scope_id, enabled, manual_visible);

create index if not exists showcase_projections_public_scope_idx
  on public.showcase_projections (public_scope_id, enabled);

create or replace function public.guard_showcase_scope_pair()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_private_kind text;
  v_private_motorcycle text;
  v_public_kind text;
  v_public_motorcycle text;
begin
  select kind, motorcycle_id
    into v_private_kind, v_private_motorcycle
    from public.owner_scopes
   where id = new.private_scope_id;
  select kind, motorcycle_id
    into v_public_kind, v_public_motorcycle
    from public.owner_scopes
   where id = new.public_scope_id;

  if v_private_kind is distinct from 'private_owner'
     or v_public_kind is distinct from 'public_showcase'
     or v_private_motorcycle is distinct from new.motorcycle_id
     or v_public_motorcycle is distinct from new.motorcycle_id then
    raise exception using
      errcode = '23514',
      message = 'Showcase scopes must be the private and public scopes for the same motorcycle.';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'showcase_projections_scope_guard'
       and tgrelid = 'public.showcase_projections'::regclass
  ) then
    create trigger showcase_projections_scope_guard
      before insert or update of private_scope_id, public_scope_id, motorcycle_id
      on public.showcase_projections
      for each row
      execute function public.guard_showcase_scope_pair();
  end if;
end
$$;

create or replace function public.guard_owner_account_private_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
      from public.owner_scopes
     where id = new.private_scope_id
       and kind = 'private_owner'
  ) then
    raise exception using
      errcode = '23514',
      message = 'An owner account must map to a private owner scope.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'owner_accounts_private_scope_guard'
       and tgrelid = 'public.owner_accounts'::regclass
  ) then
    create trigger owner_accounts_private_scope_guard
      before insert or update of private_scope_id
      on public.owner_accounts
      for each row
      execute function public.guard_owner_account_private_scope();
  end if;
end
$$;

create table if not exists public.showcase_snapshots (
  id uuid primary key default gen_random_uuid(),
  projection_id uuid not null references public.showcase_projections(id) on delete restrict,
  revision bigint not null check (revision > 0),
  motorcycle_payload jsonb not null,
  outlook_payload jsonb not null,
  history_payload jsonb not null,
  manual_payload jsonb,
  created_at timestamptz not null default now(),
  unique (projection_id, revision),
  unique (id, projection_id)
);

create index if not exists showcase_snapshots_projection_revision_idx
  on public.showcase_snapshots (projection_id, revision desc);

alter table public.showcase_projections
  drop constraint if exists showcase_projections_current_snapshot_id_fkey;

alter table public.showcase_projections
  add constraint showcase_projections_current_snapshot_id_fkey
  foreign key (current_snapshot_id, id)
  references public.showcase_snapshots(id, projection_id)
  on delete restrict;

create table if not exists public.showcase_manual_pages (
  snapshot_id uuid not null references public.showcase_snapshots(id) on delete restrict,
  public_page_id uuid not null default gen_random_uuid(),
  page_number integer not null check (page_number > 0 and page_number <= 100),
  printed_page_label text,
  extracted_text text,
  extraction_status text not null check (extraction_status in ('available', 'failed')),
  primary key (snapshot_id, public_page_id),
  unique (snapshot_id, page_number)
);

create index if not exists showcase_manual_pages_snapshot_page_idx
  on public.showcase_manual_pages (snapshot_id, page_number);

create table if not exists public.showcase_manual_chunks (
  snapshot_id uuid not null references public.showcase_snapshots(id) on delete restrict,
  public_chunk_id uuid not null default gen_random_uuid(),
  page_start integer not null check (page_start > 0 and page_start <= 100),
  page_end integer not null check (page_end >= page_start and page_end <= 100),
  printed_page_start text,
  printed_page_end text,
  section_label text,
  content text not null check (length(btrim(content)) > 0),
  search_vector tsvector generated always as (
    to_tsvector('simple'::regconfig, content)
  ) stored,
  primary key (snapshot_id, public_chunk_id)
);

create index if not exists showcase_manual_chunks_snapshot_page_idx
  on public.showcase_manual_chunks (snapshot_id, page_start, page_end);

create index if not exists showcase_manual_chunks_search_vector_gin_idx
  on public.showcase_manual_chunks using gin (search_vector);

create table if not exists public.showcase_assets (
  snapshot_id uuid not null references public.showcase_snapshots(id) on delete restrict,
  public_asset_id uuid not null default gen_random_uuid(),
  source_kind text not null check (source_kind = 'pdf'),
  private_storage_key text not null check (length(btrim(private_storage_key)) > 0),
  content_type text not null check (content_type = 'application/pdf'),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  primary key (snapshot_id, public_asset_id),
  unique (snapshot_id, source_kind)
);

create index if not exists showcase_assets_snapshot_kind_idx
  on public.showcase_assets (snapshot_id, source_kind);

create or replace function public.prevent_showcase_snapshot_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Public showcase snapshots are immutable.';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'showcase_snapshots_immutable_guard'
       and tgrelid = 'public.showcase_snapshots'::regclass
  ) then
    create trigger showcase_snapshots_immutable_guard
      before update or delete on public.showcase_snapshots
      for each row
      execute function public.prevent_showcase_snapshot_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'showcase_manual_pages_immutable_guard'
       and tgrelid = 'public.showcase_manual_pages'::regclass
  ) then
    create trigger showcase_manual_pages_immutable_guard
      before update or delete on public.showcase_manual_pages
      for each row
      execute function public.prevent_showcase_snapshot_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'showcase_manual_chunks_immutable_guard'
       and tgrelid = 'public.showcase_manual_chunks'::regclass
  ) then
    create trigger showcase_manual_chunks_immutable_guard
      before update or delete on public.showcase_manual_chunks
      for each row
      execute function public.prevent_showcase_snapshot_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'showcase_assets_immutable_guard'
       and tgrelid = 'public.showcase_assets'::regclass
  ) then
    create trigger showcase_assets_immutable_guard
      before update or delete on public.showcase_assets
      for each row
      execute function public.prevent_showcase_snapshot_mutation();
  end if;
end
$$;

-- Seed only the two scope records and a disabled projection for the real
-- existing GS750. No owner, Auth subject, manual, OCR, or showcase content is
-- fabricated by this migration.
insert into public.owner_scopes (kind, motorcycle_id)
select 'private_owner', 'gs750'
where exists (select 1 from public.motorcycle_state where id = 'gs750')
on conflict (kind, motorcycle_id) do nothing;

insert into public.owner_scopes (kind, motorcycle_id)
select 'public_showcase', 'gs750'
where exists (select 1 from public.motorcycle_state where id = 'gs750')
on conflict (kind, motorcycle_id) do nothing;

insert into public.showcase_projections (
  private_scope_id,
  public_scope_id,
  motorcycle_id,
  enabled,
  manual_visible,
  revision
)
select private_scope.id,
       public_scope.id,
       'gs750',
       false,
       false,
       0
  from public.owner_scopes private_scope
  join public.owner_scopes public_scope
    on public_scope.kind = 'public_showcase'
   and public_scope.motorcycle_id = private_scope.motorcycle_id
 where private_scope.kind = 'private_owner'
   and private_scope.motorcycle_id = 'gs750'
on conflict (private_scope_id) do nothing;

-- These tables are server-only. RLS has no policies by design, so Supabase
-- Data API roles cannot read or write them. The Node.js DAL uses the private
-- PostgreSQL connection and still performs application authorization.
alter table public.owner_scopes enable row level security;
alter table public.owner_accounts enable row level security;
alter table public.showcase_projections enable row level security;
alter table public.showcase_snapshots enable row level security;
alter table public.showcase_manual_pages enable row level security;
alter table public.showcase_manual_chunks enable row level security;
alter table public.showcase_assets enable row level security;

revoke all on table
  public.owner_scopes,
  public.owner_accounts,
  public.showcase_projections,
  public.showcase_snapshots,
  public.showcase_manual_pages,
  public.showcase_manual_chunks,
  public.showcase_assets
from anon, authenticated;

create or replace function public.map_owner_auth_subject_to_gs750(
  p_auth_subject uuid
)
returns table (
  owner_account_id uuid,
  auth_subject uuid,
  scope_id uuid,
  motorcycle_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope_id uuid;
  v_account_id uuid;
begin
  if p_auth_subject is null then
    raise exception 'p_auth_subject is required';
  end if;

  if not exists (
    select 1 from public.motorcycle_state where id = 'gs750'
  ) then
    raise exception 'gs750 motorcycle state does not exist';
  end if;

  insert into public.owner_scopes (kind, motorcycle_id)
  values ('private_owner', 'gs750')
  on conflict (kind, motorcycle_id) do nothing;

  select id
    into v_scope_id
    from public.owner_scopes
   where kind = 'private_owner'
     and motorcycle_id = 'gs750';

  select id
    into v_account_id
    from public.owner_accounts
   where auth_subject = p_auth_subject;

  -- There is exactly one owner mapping for the private GS750 scope. Re-running
  -- this procedure with the same or replacement manually provisioned UUID is
  -- deterministic and does not create duplicate accounts.
  delete from public.owner_accounts
   where private_scope_id = v_scope_id
     and (v_account_id is null or id <> v_account_id);

  if v_account_id is null then
    insert into public.owner_accounts (auth_subject, role, private_scope_id)
    values (p_auth_subject, 'owner', v_scope_id)
    returning id into v_account_id;
  else
    update public.owner_accounts
       set role = 'owner', private_scope_id = v_scope_id
     where id = v_account_id;
  end if;

  return query
  select oa.id, oa.auth_subject, os.id, os.motorcycle_id
    from public.owner_accounts oa
    join public.owner_scopes os on os.id = oa.private_scope_id
   where oa.id = v_account_id;
end;
$$;

revoke execute on function public.map_owner_auth_subject_to_gs750(uuid) from public;
