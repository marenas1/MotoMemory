-- MotoMemory Phase 2 OCR ingestion support.
--
-- Page rows are the durable accounting ledger for OCR. A failed page remains
-- visible and can be retried without changing the manual document identity.

alter table public.manual_pages
  add column if not exists ocr_engine text;

alter table public.manual_pages
  add column if not exists processed_at timestamptz;

-- The ingestion transaction replaces all chunks for a page. This index is an
-- additional database guard against duplicate searchable passages if a
-- worker is retried or two server invocations overlap unexpectedly.
create unique index if not exists manual_chunks_page_content_uidx
  on public.manual_chunks (manual_id, page_start, page_end, content);

create index if not exists manual_pages_status_idx
  on public.manual_pages (manual_id, extraction_status, page_number);
