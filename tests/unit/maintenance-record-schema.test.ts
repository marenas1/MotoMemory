import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/007_phase3_maintenance_history.sql",
  ),
  "utf8",
);

describe("Phase 3 maintenance record schema contract", () => {
  it("adds a motorcycle-scoped service record table and indexes", () => {
    expect(migration).toContain(
      "create table if not exists public.maintenance_records",
    );
    expect(migration).toContain(
      "references public.motorcycle_state(id) on delete cascade",
    );
    expect(migration).toContain(
      "foreign key (definition_id, motorcycle_id)",
    );
    expect(migration).toContain(
      "references public.maintenance_definitions(id, motorcycle_id)",
    );
    expect(migration).toContain("on delete set null (definition_id)");
    expect(migration).toContain("maintenance_records_motorcycle_mileage_idx");
    expect(migration).toContain("maintenance_records_motorcycle_date_idx");
    expect(migration).toContain("maintenance_records_definition_mileage_idx");
  });

  it("guards finite non-negative fields and the current-mileage boundary", () => {
    expect(migration).toContain("performed_mileage >= 0");
    expect(migration).toContain("cost >= 0");
    expect(migration).toContain("validate_maintenance_record_mileage");
    expect(migration).toContain("maintenance_records_mileage_guard");
  });

  it("does not contain destructive changes", () => {
    expect(migration.toLowerCase()).not.toMatch(/drop\s+(table|column|constraint)/);
  });
});
