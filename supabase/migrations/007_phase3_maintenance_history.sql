-- MotoMemory Phase 3 service-record foundation.
--
-- This migration is additive after the Phase 1 and Phase 2 migrations. It
-- introduces service history without changing mileage, manual, or fact rows.

-- A composite reference lets PostgreSQL enforce that a selected maintenance
-- definition belongs to the same motorcycle as its service record.
create unique index if not exists maintenance_definitions_id_motorcycle_uidx
  on public.maintenance_definitions (id, motorcycle_id);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id text not null
    references public.motorcycle_state(id) on delete cascade,
  definition_id uuid,
  service_type text not null
    check (length(btrim(service_type)) > 0),
  performed_mileage numeric not null
    check (
      performed_mileage >= 0
      and performed_mileage <> 'NaN'::numeric
      and performed_mileage <> 'Infinity'::numeric
    ),
  performed_at timestamptz,
  notes text,
  parts text[]
    check (parts is null or cardinality(parts) <= 50),
  cost numeric
    check (
      cost >= 0
      and cost <> 'NaN'::numeric
      and cost <> 'Infinity'::numeric
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_records_definition_scope_fkey
    foreign key (definition_id, motorcycle_id)
    references public.maintenance_definitions(id, motorcycle_id)
    on delete set null (definition_id)
);

create index if not exists maintenance_records_motorcycle_mileage_idx
  on public.maintenance_records (motorcycle_id, performed_mileage);

create index if not exists maintenance_records_motorcycle_date_idx
  on public.maintenance_records (motorcycle_id, performed_at);

create index if not exists maintenance_records_definition_mileage_idx
  on public.maintenance_records (
    motorcycle_id,
    definition_id,
    performed_mileage
  );

-- The repository checks this before writing, while this trigger protects the
-- same invariant for any future private server-side writer.
create or replace function public.validate_maintenance_record_mileage()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current_mileage numeric;
begin
  select current_mileage
    into v_current_mileage
    from public.motorcycle_state
   where id = new.motorcycle_id
   for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Motorcycle state was not found.';
  end if;

  if new.performed_mileage > v_current_mileage then
    raise exception using
      errcode = '22023',
      message = 'Performed mileage cannot exceed the current motorcycle mileage.';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgname = 'maintenance_records_mileage_guard'
       and tgrelid = 'public.maintenance_records'::regclass
  ) then
    create trigger maintenance_records_mileage_guard
      before insert or update of motorcycle_id, performed_mileage
      on public.maintenance_records
      for each row
      execute function public.validate_maintenance_record_mileage();
  end if;
end
$$;
