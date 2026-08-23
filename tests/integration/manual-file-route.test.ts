import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ManualDocumentRecord } from "@/lib/manual/manual-types";

const manual: ManualDocumentRecord = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  motorcycleId: "gs750",
  fileName: "gs750-manual.pdf",
  contentType: "application/pdf",
  storageKey: "manuals/gs750/123e4567-e89b-12d3-a456-426614174000.pdf",
  fileSizeBytes: 8,
  sha256: "a".repeat(64),
  pageCount: 67,
  status: "ready",
  extractionMethod: "ocr",
  errorMessage: null,
  uploadedAt: new Date(0).toISOString(),
  processedAt: new Date(0).toISOString(),
};

const { findCurrent, get } = vi.hoisted(() => ({
  findCurrent: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@/lib/data/manual-repository", () => ({
  manualRepository: { findCurrent },
}));
vi.mock("@/lib/manual/manual-storage", () => ({
  manualStorage: { get },
}));

import { GET, HEAD } from "@/app/api/manual/file/route";

describe("private manual file route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findCurrent.mockResolvedValue(manual);
    get.mockResolvedValue({
      bytes: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]),
      contentType: "application/pdf",
    });
  });

  it("streams the original PDF without exposing its storage key", async () => {
    const response = await GET(new Request("http://localhost/api/manual/file"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="manual.pdf"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await response.arrayBuffer()).toEqual(
      new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]).buffer,
    );
    expect(get).toHaveBeenCalledWith(manual.storageKey);
    expect(JSON.stringify(response.headers)).not.toContain("supabase");
  });

  it("supports a native PDF range request while keeping the route private", async () => {
    const response = await GET(
      new Request("http://localhost/api/manual/file", {
        headers: { Range: "bytes=0-3" },
      }),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-3/8");
    expect(await response.arrayBuffer()).toEqual(
      new Uint8Array([37, 80, 68, 70]).buffer,
    );
  });

  it("answers a private PDF preflight without returning the file body", async () => {
    const response = await HEAD();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe("8");
    expect(await response.text()).toBe("");
  });

  it("does not render a viewer response when no manual exists", async () => {
    findCurrent.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MANUAL_NOT_FOUND" },
    });
    expect(get).not.toHaveBeenCalled();
  });
});
