import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ManualDocumentRecord,
  ManualMaintenanceFactRecord,
} from "@/lib/manual/manual-types";

const manual: ManualDocumentRecord = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  motorcycleId: "gs750",
  fileName: "manual.pdf",
  contentType: "application/pdf",
  storageKey: "manuals/gs750/123e4567-e89b-12d3-a456-426614174000.pdf",
  fileSizeBytes: 3_700_000,
  sha256: "a".repeat(64),
  pageCount: 67,
  status: "ready",
  extractionMethod: "ocr",
  errorMessage: null,
  uploadedAt: new Date(0).toISOString(),
  processedAt: new Date(0).toISOString(),
};

const fact: ManualMaintenanceFactRecord = {
  id: "223e4567-e89b-12d3-a456-426614174000",
  motorcycleId: "gs750",
  name: "Oil change",
  intervalValue: 2000,
  intervalUnit: "mi",
  intervalMiles: 2000,
  dueWindowMiles: 2000,
  status: "active",
  source: "manual_ocr",
  notes: null,
  sourceManualId: manual.id,
  sourcePageStart: 34,
  sourcePageEnd: 34,
  sourcePrintedPageLabel: "31",
  rawOcrContext: "Oil change every 2,000 miles",
  origin: "ocr",
  correctedAt: null,
  sourceHref: "/manual?page=34&printedPage=31",
};

const { findCurrent, listMaintenanceFacts, correctMaintenanceFact } = vi.hoisted(() => ({
  findCurrent: vi.fn(),
  listMaintenanceFacts: vi.fn(),
  correctMaintenanceFact: vi.fn(),
}));
const { getMotorcycleOverview } = vi.hoisted(() => ({
  getMotorcycleOverview: vi.fn(),
}));

vi.mock("@/lib/data/manual-repository", () => ({
  manualRepository: { findCurrent, listMaintenanceFacts, correctMaintenanceFact },
}));
vi.mock("@/lib/data/motorcycle-repository", () => ({
  MOTORCYCLE_ID: "gs750",
  getMotorcycleOverview,
}));

import { GET } from "@/app/api/manual/facts/route";
import { PATCH } from "@/app/api/manual/facts/[factId]/route";

describe("manual maintenance fact routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findCurrent.mockResolvedValue(manual);
    listMaintenanceFacts.mockResolvedValue([fact]);
    correctMaintenanceFact.mockResolvedValue({ ...fact, intervalValue: 2500, intervalMiles: 2500, origin: "rider_corrected", correctedAt: new Date(0).toISOString() });
    getMotorcycleOverview.mockResolvedValue({
      motorcycle: { currentMileage: 18_501 },
      maintenanceOutlook: [{ definitionId: fact.id, intervalMiles: 2500, dueMileage: 20_000, remainingMiles: 1_499, status: "upcoming", source: "manual_ocr" }],
    });
  });

  it("returns source-linked facts with raw OCR context", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      manualId: manual.id,
      facts: [{ sourcePageStart: 34, sourcePrintedPageLabel: "31", rawOcrContext: "Oil change every 2,000 miles" }],
    });
  });

  it("corrects one fact and reads the refreshed maintenance outlook", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/manual/facts/223e4567-e89b-12d3-a456-426614174000", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intervalValue: 2500 }),
      }),
      { params: Promise.resolve({ factId: fact.id }) },
    );

    expect(response.status).toBe(200);
    expect(correctMaintenanceFact).toHaveBeenCalledWith(
      "gs750",
      manual.id,
      fact.id,
      { intervalValue: 2500 },
    );
    await expect(response.json()).resolves.toMatchObject({
      fact: { origin: "rider_corrected", intervalValue: 2500 },
      maintenanceOutlook: [{ dueMileage: 20_000 }],
    });
    expect(getMotorcycleOverview).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown correction fields before touching the fact", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/manual/facts/223e4567-e89b-12d3-a456-426614174000", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intervalValue: 2500, approve: true }),
      }),
      { params: Promise.resolve({ factId: fact.id }) },
    );

    expect(response.status).toBe(400);
    expect(correctMaintenanceFact).not.toHaveBeenCalled();
    expect(getMotorcycleOverview).not.toHaveBeenCalled();
  });
});
