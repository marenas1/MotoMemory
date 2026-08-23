-- MotoMemory Phase 2 manual storage and provenance schema.
--
-- This migration is additive after 001_phase1_schema.sql through
-- 003_phase1_mileage_function.sql. It does not alter motorcycle mileage
-- columns, the provisional maintenance row, or the mileage function.

create table if not exists public.manual_documents (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id text not null references public.motorcycle_state(id) on delete cascade,
  file_name text not null check (length(btrim(file_name)) > 0),
  content_type text not null check (content_type = 'application/pdf'),
  storage_key text not null unique,
  file_size_bytes bigint not null
    check (file_size_bytes > 0 and file_size_bytes <= 26214400),
  sha256 text not null
    check (sha256 ~ '^[0-9a-f]{64}$'),
  page_count integer not null check (page_count > 0 and page_count <= 100),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed')),
  extraction_method text not null default 'ocr'
    check (extraction_method = 'ocr'),
  error_message text,
  uploaded_at timestamptz not null default now(),
  processed_at timestamptz,
  check (status <> 'ready' or processed_at is not null)
);

create unique index if not exists manual_documents_motorcycle_sha256_uidx
  on public.manual_documents (motorcycle_id, sha256);

create unique index if not exists manual_documents_motorcycle_uidx
  on public.manual_documents (motorcycle_id);

create index if not exists manual_documents_motorcycle_status_idx
  on public.manual_documents (motorcycle_id, status);

create table if not exists public.manual_pages (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.manual_documents(id) on delete cascade,
  page_number integer not null check (page_number > 0 and page_number <= 100),
  printed_page_label text,
  extracted_text text,
  extraction_status text not null default 'available'
    check (extraction_status in ('available', 'failed')),
  error_message text,
  unique (manual_id, page_number),
  check (
    extraction_status = 'failed'
    or extracted_text is not null
  )
);

create table if not exists public.manual_chunks (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.manual_documents(id) on delete cascade,
  page_start integer not null check (page_start > 0 and page_start <= 100),
  page_end integer not null check (page_end >= page_start and page_end <= 100),
  printed_page_start text,
  printed_page_end text,
  section_label text,
  content text not null check (length(btrim(content)) > 0),
  search_vector tsvector generated always as (
    to_tsvector('simple'::regconfig, content)
  ) stored,
  processor_version text
);

create index if not exists manual_pages_manual_page_idx
  on public.manual_pages (manual_id, page_number);

create index if not exists manual_chunks_manual_page_idx
  on public.manual_chunks (manual_id, page_start, page_end);

create index if not exists manual_chunks_search_vector_gin_idx
  on public.manual_chunks using gin (search_vector);

alter table public.maintenance_definitions
  add column if not exists source_manual_id uuid
    references public.manual_documents(id) on delete set null;

alter table public.maintenance_definitions
  add column if not exists source_page_start integer;

alter table public.maintenance_definitions
  add column if not exists source_page_end integer;

alter table public.maintenance_definitions
  add column if not exists source_printed_page_label text;

alter table public.maintenance_definitions
  add column if not exists origin text
    check (origin is null or origin in ('ocr', 'rider_corrected'));

alter table public.maintenance_definitions
  add column if not exists corrected_at timestamptz;

create index if not exists maintenance_definitions_source_manual_idx
  on public.maintenance_definitions (motorcycle_id, source_manual_id);

create index if not exists maintenance_definitions_source_page_idx
  on public.maintenance_definitions (source_manual_id, source_page_start);

-- The application uses the server-only Supabase service-role credential for
-- object operations. Keep this bucket private; do not add a public URL or a
-- browser policy for it.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'manuals',
  'manuals',
  false,
  26214400,
  array['application/pdf']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
