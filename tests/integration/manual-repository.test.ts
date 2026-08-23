import { describe, expect, it } from "vitest";

import { manualRepository } from "@/lib/data/manual-repository";

describe("manual repository boundary", () => {
  it("rejects invalid metadata before requiring database credentials", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    await expect(
      manualRepository.createDocument({
        id: "123e4567-e89b-12d3-a456-426614174000",
        motorcycleId: "gs750",
        fileName: "manual.pdf",
        contentType: "application/pdf",
        storageKey: "manuals/gs750/manual.pdf",
        fileSizeBytes: 0,
        sha256: "a".repeat(64),
        pageCount: 67,
      }),
    ).rejects.toThrow("between 1 byte");

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });
});
