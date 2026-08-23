import { describe, expect, it } from "vitest";

import {
  MAX_MANUAL_FILE_SIZE_BYTES,
  MAX_MANUAL_PAGE_COUNT,
  buildManualStorageKey,
  hashManualBytes,
  validateManualMetadata,
  validateManualStorageKey,
} from "@/lib/manual/manual-validation";

const validMetadata = {
  fileName: "gs750-manual.pdf",
  contentType: "application/pdf",
  fileSizeBytes: 3_700_000,
  sha256: "a".repeat(64),
  pageCount: 67,
};

describe("manual validation boundary", () => {
  it("hashes the exact uploaded bytes with SHA-256", () => {
    expect(hashManualBytes(new TextEncoder().encode("hello"))).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("accepts the selected manual within the starting limits", () => {
    expect(validateManualMetadata(validMetadata)).toEqual(validMetadata);
    expect(
      validateManualMetadata({
        ...validMetadata,
        fileSizeBytes: MAX_MANUAL_FILE_SIZE_BYTES,
        pageCount: MAX_MANUAL_PAGE_COUNT,
      }),
    ).toMatchObject({
      fileSizeBytes: MAX_MANUAL_FILE_SIZE_BYTES,
      pageCount: MAX_MANUAL_PAGE_COUNT,
    });
  });

  it.each([
    ["wrong content type", { contentType: "text/plain" }],
    ["empty file", { fileSizeBytes: 0 }],
    ["oversized file", { fileSizeBytes: MAX_MANUAL_FILE_SIZE_BYTES + 1 }],
    ["too many pages", { pageCount: MAX_MANUAL_PAGE_COUNT + 1 }],
    ["invalid digest", { sha256: "not-a-digest" }],
  ])("rejects %s", (_description, change) => {
    expect(() => validateManualMetadata({ ...validMetadata, ...change })).toThrow();
  });

  it("allows only safe object paths", () => {
    expect(validateManualStorageKey("manuals/gs750/document.pdf")).toBe(
      "manuals/gs750/document.pdf",
    );
    expect(() => validateManualStorageKey("../document.pdf")).toThrow();
    expect(() => validateManualStorageKey("/document.pdf")).toThrow();
  });

  it("builds a stable motorcycle-scoped PDF object key", () => {
    expect(
      buildManualStorageKey(
        "gs750",
        "123e4567-e89b-12d3-a456-426614174000",
      ),
    ).toBe("manuals/gs750/123e4567-e89b-12d3-a456-426614174000.pdf");
  });
});
