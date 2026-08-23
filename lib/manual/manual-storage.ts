import "server-only";

import { MANUAL_STORAGE_BUCKET, validateManualStorageKey } from "@/lib/manual/manual-validation";

export interface StoredManualObject {
  bytes: Uint8Array;
  contentType: string;
}

export interface ManualObjectStorage {
  put(storageKey: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(storageKey: string): Promise<StoredManualObject>;
  remove(storageKey: string): Promise<void>;
}

export class ManualStorageError extends Error {
  readonly status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "ManualStorageError";
    this.status = status;
  }
}

type StorageFetch = (input: string, init?: RequestInit) => Promise<Response>;

interface SupabaseManualStorageOptions {
  projectUrl?: string;
  serviceRoleKey?: string;
  bucket?: string;
  fetcher?: StorageFetch;
}

function getConfiguration(options: SupabaseManualStorageOptions) {
  const projectUrl = (options.projectUrl ?? process.env.SUPABASE_PROJECT_URL)?.replace(
    /\/$/,
    "",
  );
  const serviceRoleKey =
    options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = options.bucket ?? process.env.SUPABASE_STORAGE_BUCKET ?? MANUAL_STORAGE_BUCKET;

  if (!projectUrl || !serviceRoleKey || !bucket) {
    throw new ManualStorageError(
      "Supabase private manual storage is not configured on the server.",
      503,
    );
  }

  return { projectUrl, serviceRoleKey, bucket };
}

function encodeStoragePath(storageKey: string): string {
  return validateManualStorageKey(storageKey)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function buildObjectUrl(
  projectUrl: string,
  bucket: string,
  storageKey: string,
): string {
  return `${projectUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(storageKey)}`;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const message = (await response.text()).trim();
    return message ? ` (${message.slice(0, 240)})` : "";
  } catch {
    return "";
  }
}

export function createSupabaseManualStorage(
  options: SupabaseManualStorageOptions = {},
): ManualObjectStorage {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);

  async function request(
    method: "POST" | "GET" | "DELETE",
    storageKey: string,
    body?: Uint8Array,
    contentType?: string,
  ): Promise<Response> {
    const { projectUrl, serviceRoleKey, bucket } = getConfiguration(options);
    const headers = new Headers({
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    });

    if (method === "POST") {
      headers.set("Content-Type", contentType ?? "application/octet-stream");
      headers.set("x-upsert", "false");
    }

    let response: Response;
    try {
      response = await fetcher(buildObjectUrl(projectUrl, bucket, storageKey), {
        method,
        headers,
        body: method === "POST" && body ? Buffer.from(body) : undefined,
      });
    } catch (error) {
      throw new ManualStorageError(
        `Supabase private manual storage could not be reached: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      throw new ManualStorageError(
        `Supabase private manual storage rejected the ${method.toLowerCase()} request${await responseMessage(response)}.`,
        response.status >= 400 && response.status < 500 ? response.status : 503,
      );
    }

    return response;
  }

  return {
    async put(storageKey, bytes, contentType) {
      await request("POST", storageKey, bytes, contentType);
    },

    async get(storageKey) {
      const response = await request("GET", storageKey);
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") ?? "application/pdf",
      };
    },

    async remove(storageKey) {
      await request("DELETE", storageKey);
    },
  };
}

export const manualStorage = createSupabaseManualStorage();
