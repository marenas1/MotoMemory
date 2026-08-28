import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/server/errors";
import { TEST_SCOPE } from "@/tests/fixtures/test-scope";

const mutationGuard = vi.hoisted(() => ({ requireOwnerMode: vi.fn() }));
const readAccess = vi.hoisted(() => ({ getReadableScope: vi.fn() }));
const repositoryCalls = vi.hoisted(() => ({
  motorcycle: vi.fn(),
  maintenance: vi.fn(),
  manual: vi.fn(),
}));

vi.mock("@/lib/server/mutation-guard", () => mutationGuard);
vi.mock("@/lib/server/read-access", () => readAccess);
vi.mock("@/lib/data/motorcycle-repository", () => ({
  getMotorcycleOverview: repositoryCalls.motorcycle,
  motorcycleRepository: { updateMileage: repositoryCalls.motorcycle },
}));
vi.mock("@/lib/data/maintenance-repository", () => ({
  maintenanceRepository: {
    listActiveMaintenanceDefinitions: repositoryCalls.maintenance,
    listMaintenanceRecords: repositoryCalls.maintenance,
    createMaintenanceRecord: repositoryCalls.maintenance,
    updateMaintenanceRecord: repositoryCalls.maintenance,
    deleteMaintenanceRecord: repositoryCalls.maintenance,
  },
}));
vi.mock("@/lib/data/manual-repository", () => ({
  manualRepository: {
    findCurrent: repositoryCalls.manual,
    getIngestionProgress: repositoryCalls.manual,
    listMaintenanceFacts: repositoryCalls.manual,
    correctMaintenanceFact: repositoryCalls.manual,
  },
}));
vi.mock("@/lib/manual/manual-upload", () => ({
  uploadConfiguredManual: repositoryCalls.manual,
}));
vi.mock("@/lib/manual/manual-ingestion", () => ({
  startConfiguredManualIngestion: repositoryCalls.manual,
  enqueueConfiguredManualIngestion: repositoryCalls.manual,
}));
vi.mock("@/lib/manual/manual-storage", () => ({
  manualStorage: { get: repositoryCalls.manual },
}));
vi.mock("@/lib/manual/manual-answering", () => ({
  answerManualQuestion: repositoryCalls.manual,
}));
vi.mock("@/lib/manual/retrieval", () => ({
  searchManualChunks: repositoryCalls.manual,
}));

import { GET as getMotorcycle } from "@/app/api/motorcycle/route";
import { PATCH as patchMileage } from "@/app/api/motorcycle/mileage/route";
import {
  GET as getMaintenance,
  POST as postMaintenance,
} from "@/app/api/maintenance/records/route";
import {
  DELETE as deleteMaintenance,
  PATCH as patchMaintenance,
} from "@/app/api/maintenance/records/[recordId]/route";
import { GET as getManual, POST as postManual } from "@/app/api/manual/route";
import { POST as postManualIngest } from "@/app/api/manual/ingest/route";
import { GET as getManualFacts } from "@/app/api/manual/facts/route";
import { PATCH as patchManualFact } from "@/app/api/manual/facts/[factId]/route";

const recordParams = { params: Promise.resolve({ recordId: "123e4567-e89b-12d3-a456-426614174000" }) };
const factParams = { params: Promise.resolve({ factId: "123e4567-e89b-12d3-a456-426614174000" }) };

const ownerMutationCalls: Array<() => Promise<Response>> = [
  () => patchMileage(new Request("http://localhost/api/motorcycle/mileage", { method: "PATCH" })),
  () => postMaintenance(new Request("http://localhost/api/maintenance/records", { method: "POST" })),
  () => patchMaintenance(new Request("http://localhost/api/maintenance/records/id", { method: "PATCH" }), recordParams),
  () => deleteMaintenance(new Request("http://localhost/api/maintenance/records/id", { method: "DELETE" }), recordParams),
  () => postManual(new Request("http://localhost/api/manual", { method: "POST" })),
  () => postManualIngest(),
  () => patchManualFact(new Request("http://localhost/api/manual/facts/id", { method: "PATCH" }), factParams),
];

describe("runtime mode mutation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects every mutation in read-only mode before any repository, Storage, or OCR dependency", async () => {
    mutationGuard.requireOwnerMode.mockImplementation(() => {
      throw new AppError(
        "READ_ONLY_MODE",
        "This MotoMemory deployment is read-only.",
        403,
      );
    });

    for (const call of ownerMutationCalls) {
      const response = await call();
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "READ_ONLY_MODE" },
      });
    }

    expect(repositoryCalls.motorcycle).not.toHaveBeenCalled();
    expect(repositoryCalls.maintenance).not.toHaveBeenCalled();
    expect(repositoryCalls.manual).not.toHaveBeenCalled();
  });

  it("allows guest reads through the live read scope", async () => {
    readAccess.getReadableScope.mockResolvedValue({ scope: TEST_SCOPE, isOwner: false });
    repositoryCalls.motorcycle.mockResolvedValue({ motorcycle: { currentMileage: 1 }, maintenanceOutlook: [] });
    repositoryCalls.maintenance.mockResolvedValue([]);
    repositoryCalls.manual.mockResolvedValue(null);

    await expect((await getMotorcycle()).status).toBe(200);
    await expect((await getMaintenance()).status).toBe(200);
    await expect((await getManual()).status).toBe(200);
    await expect((await getManualFacts()).status).toBe(404);
    expect(readAccess.getReadableScope).toHaveBeenCalled();
  });

  it("allows owner mode reads through the fixed application scope", async () => {
    mutationGuard.requireOwnerMode.mockReturnValue(undefined);
    readAccess.getReadableScope.mockResolvedValue({ scope: TEST_SCOPE, isOwner: true });
    repositoryCalls.motorcycle.mockResolvedValue({ motorcycle: { currentMileage: 1 }, maintenanceOutlook: [] });

    const response = await getMotorcycle();

    expect(response.status).toBe(200);
    expect(repositoryCalls.motorcycle).toHaveBeenCalledWith(TEST_SCOPE);
  });
});
