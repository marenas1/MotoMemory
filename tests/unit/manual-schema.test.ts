import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/004_phase2_manual_schema.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const ingestionMigration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/005_phase2_ocr_ingestion.sql"),
  "utf8",
);
const factsMigration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/006_phase2_maintenance_facts.sql"),
  "utf8",
);

describe("Phase 2 schema contract", () => {
  it("adds manual metadata, page provenance, chunks, and source fields", () => {
    expect(migration).toContain("create table if not exists public.manual_documents");
    expect(migration).toContain("create table if not exists public.manual_pages");
    expect(migration).toContain("create table if not exists public.manual_chunks");
    expect(migration).toContain("add column if not exists source_manual_id");
    expect(migration).toContain("add column if not exists source_page_start");
    expect(migration).toContain("add column if not exists source_page_end");
    expect(migration).toContain("add column if not exists origin");
  });

  it("represents the upload limits, duplicate identity, and private bucket", () => {
    expect(migration).toContain("file_size_bytes <= 26214400");
    expect(migration).toContain("page_count > 0 and page_count <= 100");
    expect(migration).toContain("sha256 ~ '^[0-9a-f]{64}$'");
    expect(migration).toContain("on public.manual_documents (motorcycle_id, sha256)");
    expect(migration).toContain("on public.manual_documents (motorcycle_id);");
    expect(migration).toMatch(/'manuals',[\s\S]*'manuals',[\s\S]*false/);
    expect(migration).not.toContain("public = true");
  });

  it("does not redefine the Phase 1 mileage function", () => {
    expect(migration).not.toContain("update_motorcycle_mileage");
    expect(migration).not.toContain("mileage_updates");
    expect(migration).not.toContain("current_mileage =");
  });

  it("adds durable OCR processing metadata and a duplicate-chunk guard", () => {
    expect(ingestionMigration).toContain(
      "add column if not exists ocr_engine",
    );
    expect(ingestionMigration).toContain(
      "add column if not exists processed_at",
    );
    expect(ingestionMigration).toContain(
      "manual_chunks_page_content_uidx",
    );
    expect(ingestionMigration).toContain(
      "manual_pages_status_idx",
    );
  });

  it("adds source-linked fact values and preserves the provisional fallback", () => {
    expect(factsMigration).toContain("add column if not exists interval_value");
    expect(factsMigration).toContain("add column if not exists interval_unit");
    expect(factsMigration).toContain("add column if not exists source_ocr_context");
    expect(factsMigration).toContain("maintenance_definitions_manual_source_check");
    expect(factsMigration).toContain("disable_provisional_maintenance_if_manual_fact_exists");
    expect(factsMigration).not.toContain("mileage_updates");
    expect(factsMigration).not.toContain("current_mileage =");
  });
});
