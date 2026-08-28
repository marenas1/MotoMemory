import "server-only";

import type { AppErrorCode } from "@/lib/server/errors";
import { AppError } from "@/lib/server/errors";

export const MAX_JSON_BODY_BYTES = 16 * 1024;

interface BoundedJsonOptions {
  maxBytes?: number;
  invalidCode?: AppErrorCode;
  invalidMessage?: string;
  tooLargeMessage?: string;
}

function requestTooLarge(message: string): AppError {
  return new AppError("REQUEST_TOO_LARGE", message, 413);
}

/** Parse JSON only after consuming a small, explicit request-body budget. */
export async function readBoundedJson(
  request: Request,
  options: BoundedJsonOptions = {},
): Promise<unknown> {
  const maxBytes = options.maxBytes ?? MAX_JSON_BODY_BYTES;
  const invalidCode = options.invalidCode ?? "INVALID_REQUEST";
  const invalidMessage = options.invalidMessage ?? "A JSON request body is required.";
  const tooLargeMessage =
    options.tooLargeMessage ?? "The request body is too large.";
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBytes) {
      throw requestTooLarge(tooLargeMessage);
    }
  }

  try {
    const reader = request.body?.getReader();
    if (!reader) {
      throw new SyntaxError("empty body");
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      totalBytes += next.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw requestTooLarge(tooLargeMessage);
      }
      chunks.push(next.value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(invalidCode, invalidMessage, 400);
  }
}
