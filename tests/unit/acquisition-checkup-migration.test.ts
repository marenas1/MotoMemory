import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/011_seed_acquisition_checkup.sql",
  ),
  "utf8",
);

describe("acquisition checkup migration contract", () => {
  it("seeds one linked 18,000-mile checkup for active definitions without history", () => {
    expect(migration).toContain("insert into public.maintenance_records");
    expect(migration).toContain("definition.status = 'active'");
    expect(migration).toContain("definition.motorcycle_id = 'gs750'");
    expect(migration).toContain("performed_mileage");
    expect(migration).toContain("18000");
    expect(migration).toContain("definition_id = definition.id");
    expect(migration).toContain("not exists");
    expect(migration).toContain("Exact date, parts, and cost were not recorded.");
  });

  it("does not overwrite or delete existing history", () => {
    expect(migration.toLowerCase()).not.toMatch(
      /\b(update|delete|truncate|drop)\b/,
    );
  });
});
