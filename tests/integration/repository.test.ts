import { describe, expect, it } from "vitest";

import { getMotorcycleOverview } from "../../lib/data/motorcycle-repository";

describe("database repository boundary", () => {
  it("does not fabricate state when DATABASE_URL is absent", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    await expect(getMotorcycleOverview()).rejects.toMatchObject({
      code: "INVALID_CONFIGURATION",
    });

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });
});
