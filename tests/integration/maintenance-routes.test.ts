import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  listActiveMaintenanceDefinitions: vi.fn(),
  listMaintenanceRecords: vi.fn(),
  createMaintenanceRecord: vi.fn(),
  updateMaintenanceRecord: vi.fn(),
  deleteMaintenanceRecord: vi.fn(),
}));

const getMotorcycleOverview = vi.hoisted(() => vi.fn());
const { requireOwnerMode } = vi.hoisted(() => ({ requireOwnerMode: vi.fn() }));
const { getReadableScope } = vi.hoisted(() => ({ getReadableScope: vi.fn() }));

vi.mock("@/lib/data/maintenance-repository", () => ({
  maintenanceRepository: repository,
}));

vi.mock("@/lib/data/motorcycle-repository", () => ({
  getMotorcycleOverview,
}));
vi.mock("@/lib/server/mutation-guard", () => ({ requireOwnerMode }));
vi.mock("@/lib/server/read-access", () => ({ getReadableScope }));

import { TEST_SCOPE } from "@/tests/fixtures/test-scope";
import { OWNER_SCOPE } from "@/lib/server/owner-scope";

import { DELETE, PATCH } from "@/app/api/maintenance/records/[recordId]/route";
import { GET, POST } from "@/app/api/maintenance/records/route";

const definition = {
  id: "223e4567-e89b-12d3-a456-426614174000",
  motorcycleId: "gs750",
  name: "Engine oil",
  intervalValue: 2500,
  intervalUnit: "mi" as const,
  intervalMiles: 2500,
  dueWindowMiles: 250,
  status: "active" as const,
  source: "manual_ocr",
  notes: null,
  sourceManualId: "323e4567-e89b-12d3-a456-426614174000",
  sourcePageStart: 42,
  sourcePageEnd: 42,
  sourcePrintedPageLabel: "38",
  origin: "ocr" as const,
  correctedAt: null,
  sourceHref: "/manual#page=42",
};

const record = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  motorcycleId: "gs750",
  definitionId: definition.id,
  serviceType: definition.name,
  performedMileage: 18500,
  performedAt: null,
  notes: null,
  parts: null,
  cost: null,
  createdAt: "2026-08-23T12:00:00.000Z",
  updatedAt: "2026-08-23T12:00:00.000Z",
};

describe("maintenance history routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerMode.mockReturnValue(undefined);
    getReadableScope.mockResolvedValue({ scope: TEST_SCOPE, isOwner: true });
    getMotorcycleOverview.mockResolvedValue({
      motorcycle: { currentMileage: 18501 },
      maintenanceOutlook: [],
    });
    repository.listActiveMaintenanceDefinitions.mockResolvedValue([definition]);
    repository.listMaintenanceRecords.mockResolvedValue([record]);
    repository.createMaintenanceRecord.mockResolvedValue(record);
    repository.updateMaintenanceRecord.mockResolvedValue(record);
    repository.deleteMaintenanceRecord.mockResolvedValue(undefined);
  });

  it("lists the scoped records, current mileage, and active picker definitions", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      currentMileage: 18501,
      definitions: [definition],
      records: [record],
    });
    expect(repository.listMaintenanceRecords).toHaveBeenCalledWith(TEST_SCOPE);
    expect(repository.listActiveMaintenanceDefinitions).toHaveBeenCalledWith(TEST_SCOPE);
  });

  it("normalizes a linked create to the selected active definition", async () => {
    const response = await POST(
      new Request("http://localhost/api/maintenance/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          definitionId: definition.id,
          serviceType: "Client supplied bundle of unrelated work",
          performedMileage: "18500",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(repository.createMaintenanceRecord).toHaveBeenCalledWith(OWNER_SCOPE, {
      definitionId: definition.id,
      serviceType: definition.name,
      performedMileage: 18500,
      performedAt: null,
      notes: null,
      parts: null,
      cost: null,
    });
  });

  it("allows an explicit Other / unlinked record without a definition", async () => {
    const response = await POST(
      new Request("http://localhost/api/maintenance/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          definitionId: null,
          serviceType: "Repaired loose mirror",
          performedMileage: 18000,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(repository.createMaintenanceRecord).toHaveBeenCalledWith(OWNER_SCOPE, {
      definitionId: null,
      serviceType: "Repaired loose mirror",
      performedMileage: 18000,
      performedAt: null,
      notes: null,
      parts: null,
      cost: null,
    });
  });

  it("updates and deletes by record ID while retaining the motorcycle scope", async () => {
    const params = Promise.resolve({ recordId: record.id });
    const updateResponse = await PATCH(
      new Request("http://localhost/api/maintenance/records/" + record.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: "Updated" }),
      }),
      { params },
    );
    const deleteResponse = await DELETE(
      new Request("http://localhost/api/maintenance/records/" + record.id, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ recordId: record.id }) },
    );

    expect(updateResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(repository.updateMaintenanceRecord).toHaveBeenCalledWith(OWNER_SCOPE, record.id, {
      notes: "Updated",
    });
    expect(repository.deleteMaintenanceRecord).toHaveBeenCalledWith(OWNER_SCOPE, record.id);
    await expect(deleteResponse.json()).resolves.toEqual({ deletedId: record.id });
  });

  it("normalizes a linked edit to an active definition", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/maintenance/records/" + record.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          definitionId: definition.id,
          serviceType: "Incorrect client label",
        }),
      }),
      { params: Promise.resolve({ recordId: record.id }) },
    );

    expect(response.status).toBe(200);
    expect(repository.updateMaintenanceRecord).toHaveBeenCalledWith(OWNER_SCOPE, record.id, {
      definitionId: definition.id,
      serviceType: definition.name,
    });
  });

  it("rejects malformed IDs and invalid bodies before a write", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/maintenance/records/not-a-uuid", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ recordId: "not-a-uuid" }) },
    );
    const invalidBodyResponse = await POST(
      new Request("http://localhost/api/maintenance/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceType: "Oil", performedMileage: -1 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(invalidBodyResponse.status).toBe(400);
    expect(repository.deleteMaintenanceRecord).not.toHaveBeenCalled();
    expect(repository.createMaintenanceRecord).not.toHaveBeenCalled();
  });
});
