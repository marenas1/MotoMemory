import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeOwnerSave } from "@/lib/data/owner-save-coordinator";
import { TEST_SCOPE } from "@/tests/fixtures/test-scope";

const committed = vi.hoisted(() => ({
  mileage: 18_501,
  mileageUpdates: [{ acceptedMileage: 18_501 }],
}));

const database = vi.hoisted(() => ({ connect: vi.fn() }));

vi.mock("pg", () => ({
  Pool: class {
    connect = database.connect;
  },
}));

function cloneState() {
  return {
    mileage: committed.mileage,
    mileageUpdates: committed.mileageUpdates.map((event) => ({ ...event })),
  };
}

describe("owner save transaction boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test/motomemory";
    committed.mileage = 18_501;
    committed.mileageUpdates = [{ acceptedMileage: 18_501 }];

    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    let working = cloneState();
    client.query.mockImplementation(async (query: string) => {
      if (query === "begin") {
        working = cloneState();
        return { rows: [] };
      }
      if (query === "rollback") {
        working = cloneState();
        return { rows: [] };
      }
      if (query === "commit") {
        committed.mileage = working.mileage;
        committed.mileageUpdates = working.mileageUpdates;
        return { rows: [] };
      }
      if (query.includes("showcase") || query.includes("projection")) {
        throw new Error("owner saves must not query discarded projection tables");
      }
      if (query.includes("from public.motorcycle_state")) {
        return { rows: [{ current_mileage: String(working.mileage) }] };
      }
      if (query.includes("update public.motorcycle_state")) {
        working.mileage = 17_000;
        return { rows: [] };
      }
      if (query.includes("insert into public.mileage_updates")) {
        working.mileageUpdates.push({ acceptedMileage: 17_000 });
        return { rows: [] };
      }
      return { rows: [] };
    });
    database.connect.mockResolvedValue(client);
  });

  it("commits live source mutations without requiring a showcase projection", async () => {
    const result = await executeOwnerSave(TEST_SCOPE, async (client) => {
      await client.query("update public.motorcycle_state set current_mileage = $1", [17_000]);
      await client.query("insert into public.mileage_updates (accepted_mileage)", [17_000]);
      return { result: "committed", changed: true };
    });

    expect(result).toBe("committed");
    expect(committed).toEqual({
      mileage: 17_000,
      mileageUpdates: [
        { acceptedMileage: 18_501 },
        { acceptedMileage: 17_000 },
      ],
    });
  });

  it("rolls back live source mutations when the owner mutation fails", async () => {
    await expect(
      executeOwnerSave(TEST_SCOPE, async (client) => {
        await client.query("update public.motorcycle_state set current_mileage = $1", [17_000]);
        await client.query("insert into public.mileage_updates (accepted_mileage)", [17_000]);
        throw new Error("injected mutation failure");
      }),
    ).rejects.toThrow("injected mutation failure");

    expect(committed).toEqual({
      mileage: 18_501,
      mileageUpdates: [{ acceptedMileage: 18_501 }],
    });
  });

});
