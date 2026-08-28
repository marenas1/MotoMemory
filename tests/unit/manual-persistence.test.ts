import { describe, expect, it } from "vitest";

import { persistManualDocument } from "@/lib/manual/manual-persistence";
import { TEST_SCOPE } from "@/tests/fixtures/test-scope";

describe("manual persistence cleanup boundary", () => {
  it("removes the stored object when metadata creation fails", async () => {
    const putKeys: string[] = [];
    const removedKeys: string[] = [];

    await expect(
      persistManualDocument(
        {
          scope: TEST_SCOPE,
          fileName: "manual.pdf",
          contentType: "application/pdf",
          bytes: new Uint8Array([1, 2, 3]),
          pageCount: 67,
        },
        {
          storage: {
            put: async (storageKey) => {
              putKeys.push(storageKey);
            },
            get: async () => ({
              bytes: new Uint8Array(),
              contentType: "application/pdf",
            }),
            remove: async (storageKey) => {
              removedKeys.push(storageKey);
            },
          },
          repository: {
            findBySha256: async () => null,
            findCurrent: async () => null,
            createDocument: async () => {
              throw new Error("database write failed");
            },
          },
        },
      ),
    ).rejects.toThrow("database write failed");

    expect(putKeys).toHaveLength(1);
    expect(removedKeys).toEqual(putKeys);
  });

  it("cleans the exact object key when storage reports an upload failure", async () => {
    const removedKeys: string[] = [];

    await expect(
      persistManualDocument(
        {
          scope: TEST_SCOPE,
          fileName: "manual.pdf",
          contentType: "application/pdf",
          bytes: new Uint8Array([1, 2, 3]),
          pageCount: 67,
        },
        {
          storage: {
            put: async () => {
              throw new Error("storage write failed");
            },
            get: async () => ({
              bytes: new Uint8Array(),
              contentType: "application/pdf",
            }),
            remove: async (storageKey) => {
              removedKeys.push(storageKey);
            },
          },
          repository: {
            findBySha256: async () => null,
            findCurrent: async () => null,
            createDocument: async () => {
              throw new Error("should not register metadata");
            },
          },
        },
      ),
    ).rejects.toThrow("storage write failed");

    expect(removedKeys).toHaveLength(1);
    expect(removedKeys[0]).toMatch(/^manuals\/gs750\/[0-9a-f-]+\.pdf$/);
  });

  it("rejects a duplicate before creating a storage object", async () => {
    const putKeys: string[] = [];

    await expect(
      persistManualDocument(
        {
          scope: TEST_SCOPE,
          fileName: "manual.pdf",
          contentType: "application/pdf",
          bytes: new Uint8Array([1, 2, 3]),
          pageCount: 67,
        },
        {
          storage: {
            put: async (storageKey) => {
              putKeys.push(storageKey);
            },
            get: async () => ({
              bytes: new Uint8Array(),
              contentType: "application/pdf",
            }),
            remove: async () => undefined,
          },
          repository: {
            findBySha256: async () => ({
              id: "existing",
              motorcycleId: "gs750",
              fileName: "manual.pdf",
              contentType: "application/pdf",
              storageKey: "manuals/gs750/existing.pdf",
              fileSizeBytes: 3,
              sha256: "039058c7f3c6f3e6a6f2c9f3f7a9d3b4a8f1b9d2b8c3d4e5f6a7b8c9d0e1f2a3b",
              pageCount: 67,
              status: "uploaded",
              extractionMethod: "ocr",
              errorMessage: null,
              uploadedAt: new Date(0).toISOString(),
              processedAt: null,
            }),
            findCurrent: async () => null,
            createDocument: async () => {
              throw new Error("should not register metadata");
            },
          },
        },
      ),
    ).rejects.toMatchObject({ code: "MANUAL_DUPLICATE", status: 409 });

    expect(putKeys).toHaveLength(0);
  });
});
