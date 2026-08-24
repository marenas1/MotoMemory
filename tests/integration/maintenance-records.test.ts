import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: class {
    connect = database.connect;
    query = database.query;
  },
}));

import { maintenanceRepository } from "@/lib/data/maintenance-repository";

const motorcycleId = "gs750";
const recordId = "123e4567-e89b-12d3-a456-426614174000";
const definitionId = "223e4567-e89b-12d3-a456-426614174000";

const row = {
  id: recordId,
  motorcycle_id: motorcycleId,
  definition_id: definitionId,
  service_type: "Oil change",
  performed_mileage: "18501",
  performed_at: new Date("2025-01-02T00:00:00.000Z"),
  notes: "Changed oil and filter.",
  parts: ["Oil filter"],
  cost: "42.50",
  created_at: new Date("2025-01-02T00:00:00.000Z"),
  updated_at: new Date("2025-01-02T00:00:00.000Z"),
};

const client = {
  query: vi.fn(),
  release: vi.fn(),
};

function configureClient(): void {
  client.query.mockImplementation(async (query: string) => {
    if (query === "begin" || query === "commit" || query === "rollback") {
      return { rows: [] };
    }
    if (query.includes("select current_mileage")) {
      return { rows: [{ current_mileage: "18501" }] };
    }
    if (query.includes("insert into public.maintenance_records")) {
      return { rows: [row] };
    }
    if (query.includes("from public.maintenance_records")) {
      return { rows: [row] };
    }
    if (query.includes("update public.maintenance_records")) {
      return { rows: [row] };
    }
    return { rows: [] };
  });
  database.connect.mockResolvedValue(client);
}

describe("maintenance record repository boundary", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://test/motomemory";
    database.query.mockReset();
    database.connect.mockReset();
    client.query.mockReset();
    client.release.mockReset();
    configureClient();
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("lists only records in the requested motorcycle scope", async () => {
    database.query.mockResolvedValue({ rows: [row] });

    await expect(
      maintenanceRepository.listMaintenanceRecords(motorcycleId),
    ).resolves.toMatchObject([{ id: recordId, motorcycleId }]);

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("where motorcycle_id = $1"),
      [motorcycleId],
    );
  });

  it("creates, updates, and deletes a valid record through scoped SQL", async () => {
    await expect(
      maintenanceRepository.createMaintenanceRecord(motorcycleId, {
        definitionId,
        serviceType: "Oil change",
        performedMileage: 18_501,
      }),
    ).resolves.toMatchObject({ id: recordId, motorcycleId });

    await expect(
      maintenanceRepository.updateMaintenanceRecord(motorcycleId, recordId, {
        notes: "Updated note",
      }),
    ).resolves.toMatchObject({ id: recordId, motorcycleId });

    database.query.mockImplementation(async (query: string) => {
      if (query.includes("delete from public.maintenance_records")) {
        return { rows: [{ id: recordId }] };
      }
      return { rows: [] };
    });
    await expect(
      maintenanceRepository.deleteMaintenanceRecord(motorcycleId, recordId),
    ).resolves.toBeUndefined();

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("where id = $1\n            and motorcycle_id = $2"),
      [recordId, motorcycleId],
    );
  });

  it("rejects a record above current mileage before insert", async () => {
    await expect(
      maintenanceRepository.createMaintenanceRecord(motorcycleId, {
        serviceType: "Oil change",
        performedMileage: 18_502,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_MAINTENANCE_RECORD",
      status: 400,
    });

    expect(
      client.query.mock.calls.some(([query]) =>
        String(query).includes("insert into public.maintenance_records"),
      ),
    ).toBe(false);
    expect(client.query).toHaveBeenCalledWith("rollback");
  });

  it("rejects an update above current mileage before updating", async () => {
    await expect(
      maintenanceRepository.updateMaintenanceRecord(motorcycleId, recordId, {
        performedMileage: 18_502,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_MAINTENANCE_RECORD",
      status: 400,
    });

    expect(
      client.query.mock.calls.some(([query]) =>
        String(query).includes("update public.maintenance_records"),
      ),
    ).toBe(false);
    expect(client.query).toHaveBeenCalledWith("rollback");
  });

  it("cannot update or delete a record outside the requested scope", async () => {
    client.query.mockImplementation(async (query: string) => {
      if (query === "begin" || query === "commit" || query === "rollback") {
        return { rows: [] };
      }
      if (query.includes("select current_mileage")) {
        return { rows: [{ current_mileage: "18501" }] };
      }
      if (query.includes("from public.maintenance_records")) {
        return { rows: [] };
      }
      return { rows: [] };
    });
    database.query.mockImplementation(async (query: string) => {
      if (query.includes("delete from public.maintenance_records")) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    await expect(
      maintenanceRepository.updateMaintenanceRecord(motorcycleId, recordId, {
        notes: "Must not cross scope",
      }),
    ).rejects.toMatchObject({ code: "MAINTENANCE_RECORD_NOT_FOUND" });

    await expect(
      maintenanceRepository.deleteMaintenanceRecord(motorcycleId, recordId),
    ).rejects.toMatchObject({ code: "MAINTENANCE_RECORD_NOT_FOUND" });

    const recordReads = client.query.mock.calls.filter(([query]) =>
      String(query).includes("from public.maintenance_records"),
    );
    expect(recordReads[0]?.[1]).toEqual([recordId, motorcycleId]);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("where id = $1\n            and motorcycle_id = $2"),
      [recordId, motorcycleId],
    );
  });
});
