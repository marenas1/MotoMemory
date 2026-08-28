import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  query: vi.fn(),
}));

const history = vi.hoisted(() => ({
  listMaintenanceRecords: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: class {
    query = database.query;
  },
}));

vi.mock("@/lib/data/maintenance-repository", () => ({
  maintenanceRepository: history,
}));

import { motorcycleRepository } from "@/lib/data/motorcycle-repository";
import type { MaintenanceRecord } from "@/lib/domain/types";
import { TEST_SCOPE } from "@/tests/fixtures/test-scope";

const motorcycleRow = {
  id: "gs750",
  make: "Suzuki",
  model: "GS750",
  model_year: 1977,
  current_mileage: "19700",
  mileage_unit: "mi" as const,
  visual_state: "emoji" as const,
  visual_emoji: "🏍️",
  last_mileage_update_at: null,
  last_mileage_update_origin: null,
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
};

const definitionRow = {
  id: "maintenance-1",
  motorcycle_id: "gs750",
  name: "Engine oil",
  interval_value: "4000",
  interval_unit: "mi" as const,
  interval_miles: "4000",
  due_window_miles: "4000",
  status: "active" as const,
  source: "manual_ocr",
  notes: null,
  source_manual_id: "manual-1",
  source_page_start: 42,
  source_page_end: 42,
  source_printed_page_label: "38",
  source_ocr_context: "Engine oil every 4,000 miles",
  origin: "ocr" as const,
  corrected_at: null,
};

const record = (overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id: "record-1",
  motorcycleId: "gs750",
  definitionId: "maintenance-1",
  serviceType: "Engine oil",
  performedMileage: 18_000,
  performedAt: null,
  notes: null,
  parts: null,
  cost: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("motorcycle overview maintenance calculation integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test/motomemory";
    motorcycleRow.current_mileage = "19700";
    definitionRow.interval_value = "4000";
    definitionRow.interval_miles = "4000";
    history.listMaintenanceRecords.mockResolvedValue([record()]);
    database.query.mockImplementation(async (query: string) => {
      if (query.includes("from public.motorcycle_state")) {
        return { rows: [motorcycleRow] };
      }
      if (query.includes("from public.maintenance_definitions")) {
        return { rows: [definitionRow] };
      }
      return { rows: [] };
    });
  });

  it.each([
    {
      name: "no history",
      records: [],
      mileage: "22001",
      expected: { status: "not_recorded", dueMileage: null, lastServiceMileage: null },
    },
    {
      name: "upcoming history",
      records: [record()],
      mileage: "19700",
      expected: { status: "upcoming", dueMileage: 22000, lastServiceMileage: 18000 },
    },
    {
      name: "due history",
      records: [record()],
      mileage: "22000",
      expected: { status: "due", dueMileage: 22000, lastServiceMileage: 18000 },
    },
    {
      name: "overdue history",
      records: [record()],
      mileage: "22001",
      expected: { status: "overdue", dueMileage: 22000, lastServiceMileage: 18000 },
    },
    {
      name: "inconsistent future history",
      records: [record({ performedMileage: 22002 })],
      mileage: "22001",
      expected: { status: "unknown", dueMileage: null, lastServiceMileage: null },
    },
  ])("returns the recalculated $name state", async ({ records, mileage, expected }) => {
    motorcycleRow.current_mileage = mileage;
    history.listMaintenanceRecords.mockResolvedValue(records);

    const overview = await motorcycleRepository.getOverview(TEST_SCOPE);

    expect(overview.maintenanceOutlook[0]).toMatchObject({
      ...expected,
      currentMileage: Number(mileage),
      definitionId: "maintenance-1",
      sourceManualId: "manual-1",
      sourcePageStart: 42,
      rawOcrContext: "Engine oil every 4,000 miles",
    });
    expect(history.listMaintenanceRecords).toHaveBeenCalledWith(TEST_SCOPE);
  });

  it("selects the same service event regardless of repository insertion order", async () => {
    motorcycleRow.current_mileage = "19000";
    const older = record({ id: "record-older", performedMileage: 17_000 });
    const newer = record({ id: "record-newer", performedMileage: 18_500 });

    history.listMaintenanceRecords.mockResolvedValue([older, newer]);
    const first = await motorcycleRepository.getOverview(TEST_SCOPE);
    history.listMaintenanceRecords.mockResolvedValue([newer, older]);
    const second = await motorcycleRepository.getOverview(TEST_SCOPE);

    expect(first.maintenanceOutlook).toEqual(second.maintenanceOutlook);
    expect(first.maintenanceOutlook[0]).toMatchObject({
      lastServiceRecordId: "record-newer",
      lastServiceMileage: 18_500,
      dueMileage: 22_500,
    });
  });

  it("recalculates a corrected interval while preserving service and source identity", async () => {
    motorcycleRow.current_mileage = "20000";
    history.listMaintenanceRecords.mockResolvedValue([record()]);
    const before = await motorcycleRepository.getOverview(TEST_SCOPE);

    definitionRow.interval_value = "2500";
    definitionRow.interval_miles = "2500";
    const after = await motorcycleRepository.getOverview(TEST_SCOPE);

    expect(before.maintenanceOutlook[0]).toMatchObject({
      definitionId: "maintenance-1",
      dueMileage: 22000,
      lastServiceRecordId: "record-1",
      sourceManualId: "manual-1",
    });
    expect(after.maintenanceOutlook[0]).toMatchObject({
      definitionId: "maintenance-1",
      dueMileage: 20500,
      lastServiceRecordId: "record-1",
      sourceManualId: "manual-1",
      sourcePageStart: 42,
    });
  });

  it("passes the current motorcycle mileage into every recalculation", async () => {
    const first = await motorcycleRepository.getOverview(TEST_SCOPE);
    motorcycleRow.current_mileage = "18000";
    const second = await motorcycleRepository.getOverview(TEST_SCOPE);

    expect(first.motorcycle.currentMileage).toBe(19700);
    expect(first.maintenanceOutlook[0]?.status).toBe("upcoming");
    expect(second.motorcycle.currentMileage).toBe(18000);
    expect(second.maintenanceOutlook[0]).toMatchObject({
      currentMileage: 18000,
      status: "upcoming",
      dueMileage: 22000,
    });
  });

  it("returns unknown rather than projecting from a missing interval", async () => {
    definitionRow.interval_miles = "0";

    const overview = await motorcycleRepository.getOverview(TEST_SCOPE);

    expect(overview.maintenanceOutlook[0]).toMatchObject({
      status: "unknown",
      intervalMiles: null,
      dueMileage: null,
      lastServiceRecordId: null,
    });
  });
});
