import { beforeEach, describe, expect, it, vi } from "vitest";

const readAccess = vi.hoisted(() => ({ getReadableScope: vi.fn() }));
const motorcycle = vi.hoisted(() => ({ getMotorcycleOverview: vi.fn() }));

vi.mock("@/lib/server/read-access", () => readAccess);
vi.mock("@/lib/data/motorcycle-repository", () => motorcycle);
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
import ManualPage from "@/app/manual/page";
import HistoryPage from "@/app/history/page";
import MaintenancePage from "@/app/maintenance/page";
import { TEST_SCOPE } from "@/tests/fixtures/test-scope";

describe("runtime mode page boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    motorcycle.getMotorcycleOverview.mockResolvedValue({
      motorcycle: { currentMileage: 18_501 },
      maintenanceOutlook: [],
    });
  });

  it("renders the manual page from the live read scope without owner authentication", async () => {
    readAccess.getReadableScope.mockResolvedValue({ scope: TEST_SCOPE, isOwner: false });

    const page = await ManualPage({ searchParams: Promise.resolve({}) });

    expect(page).toBeTruthy();
    expect(readAccess.getReadableScope).toHaveBeenCalledOnce();
  });

  it("renders the service history page from the live read scope without owner authentication", async () => {
    readAccess.getReadableScope.mockResolvedValue({ scope: TEST_SCOPE, isOwner: false });

    const page = await HistoryPage();

    expect(page).toBeTruthy();
    expect(readAccess.getReadableScope).toHaveBeenCalledOnce();
    expect(motorcycle.getMotorcycleOverview).toHaveBeenCalledWith(TEST_SCOPE);
  });

  it("renders the full maintenance outlook page from the live read scope", async () => {
    readAccess.getReadableScope.mockResolvedValue({ scope: TEST_SCOPE, isOwner: false });

    const page = await MaintenancePage();

    expect(page).toBeTruthy();
    expect(readAccess.getReadableScope).toHaveBeenCalledOnce();
    expect(motorcycle.getMotorcycleOverview).toHaveBeenCalledWith(TEST_SCOPE);
  });
});
