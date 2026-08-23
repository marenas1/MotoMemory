import { describe, expect, it } from "vitest";

import {
  createSupabaseManualStorage,
  type StoredManualObject,
} from "@/lib/manual/manual-storage";

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function createFakeFetcher(calls: FetchCall[]) {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });

    switch (init?.method) {
      case "GET":
        return new Response(new Uint8Array([37, 80, 68, 70]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        });
      case "POST":
        return new Response(null, { status: 200 });
      case "DELETE":
        return new Response(null, { status: 200 });
      default:
        return new Response("unexpected method", { status: 400 });
    }
  };
}

describe("private Supabase manual storage adapter", () => {
  it("uses server credentials and private object routes for put/get/remove", async () => {
    const calls: FetchCall[] = [];
    const storage = createSupabaseManualStorage({
      projectUrl: "https://example.supabase.co/",
      serviceRoleKey: "server-only-test-key",
      fetcher: createFakeFetcher(calls),
    });

    await storage.put(
      "manuals/gs750/document.pdf",
      new Uint8Array([1, 2, 3]),
      "application/pdf",
    );
    const downloaded: StoredManualObject = await storage.get(
      "manuals/gs750/document.pdf",
    );
    await storage.remove("manuals/gs750/document.pdf");

    expect(downloaded.bytes).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(downloaded.contentType).toBe("application/pdf");
    expect(calls).toHaveLength(3);
    expect(calls[0]?.url).toBe(
      "https://example.supabase.co/storage/v1/object/manuals/manuals/gs750/document.pdf",
    );
    expect(calls.every((call) => call.url.includes("/storage/v1/object/"))).toBe(
      true,
    );
    expect(calls.every((call) => !call.url.includes("/object/public/"))).toBe(
      true,
    );

    const putHeaders = new Headers(calls[0]?.init?.headers);
    expect(putHeaders.get("apikey")).toBe("server-only-test-key");
    expect(putHeaders.get("authorization")).toBe(
      "Bearer server-only-test-key",
    );
    expect(putHeaders.get("x-upsert")).toBe("false");
  });

  it("fails honestly when server storage configuration is absent", async () => {
    const storage = createSupabaseManualStorage({
      projectUrl: "",
      serviceRoleKey: "",
      fetcher: createFakeFetcher([]),
    });

    await expect(
      storage.get("manuals/gs750/document.pdf"),
    ).rejects.toThrow("not configured");
  });
});
