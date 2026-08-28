import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Phase 4.5 rate-limit migration contract", () => {
  it("defines a shared bounded operational store and atomic route-class function", () => {
    const migration = readFileSync(
      "supabase/migrations/009_phase4_public_rate_limits.sql",
      "utf8",
    );

    expect(migration).toContain("create table if not exists public.public_rate_limit_windows");
    expect(migration).toContain("client_ip inet not null");
    expect(migration).toContain("primary key (client_ip, route_class)");
    expect(migration).toContain("create or replace function public.consume_public_rate_limit");
    expect(migration).toContain("for update");
    expect(migration).toContain("limit 1000");
    expect(migration).toContain("revoke all on table public.public_rate_limit_windows from anon, authenticated");
    expect(migration).not.toContain("showcase_snapshots");
    expect(migration).not.toContain("manual_chunks");
  });

  it("qualifies the rate-limit table columns in the forward repair migration", () => {
    const migration = readFileSync(
      "supabase/migrations/012_fix_public_rate_limit_function.sql",
      "utf8",
    );

    expect(migration).toContain("create or replace function public.consume_public_rate_limit");
    expect(migration).toContain("rate_window.request_count");
    expect(migration).toContain("rate_window.violation_count");
    expect(migration).toContain("revoke execute on function public.consume_public_rate_limit");
  });
});
