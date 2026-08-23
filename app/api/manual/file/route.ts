import { NextResponse } from "next/server";

import { manualRepository } from "@/lib/data/manual-repository";
import { MOTORCYCLE_ID } from "@/lib/data/motorcycle-repository";
import { manualStorage } from "@/lib/manual/manual-storage";
import { manualApiError } from "@/lib/manual/manual-api-error";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

function parseRange(rangeHeader: string | null, length: number): { start: number; end: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=") || length < 1) {
    return null;
  }

  const range = rangeHeader.slice("bytes=".length).split(",", 1)[0]?.trim();
  const match = range?.match(/^(\d*)-(\d*)$/);
  if (!match) {
    return null;
  }

  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (!startText && !endText) {
    return null;
  }

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength) || suffixLength < 1) {
      return null;
    }
    return { start: Math.max(0, length - suffixLength), end: length - 1 };
  }

  const start = Number(startText);
  const requestedEnd = endText ? Number(endText) : length - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= length ||
    requestedEnd < start
  ) {
    return null;
  }

  return { start, end: Math.min(requestedEnd, length - 1) };
}

async function getManualBytes(): Promise<Buffer> {
  const manual = await manualRepository.findCurrent(MOTORCYCLE_ID);
  if (!manual) {
    throw new AppError(
      "MANUAL_NOT_FOUND",
      "No manual is uploaded for the GS750.",
      404,
    );
  }

  const storedObject = await manualStorage.get(manual.storageKey);
  return Buffer.from(storedObject.bytes);
}

function buildPdfHeaders(length: number): Headers {
  return new Headers({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"manual.pdf\"",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Accept-Ranges": "bytes",
      "Content-Length": String(length),
  });
}

function responseBody(bytes: Buffer): ArrayBuffer {
  return new Uint8Array(bytes).buffer as ArrayBuffer;
}

export async function HEAD() {
  try {
    const bytes = await getManualBytes();
    return new Response(null, { status: 200, headers: buildPdfHeaders(bytes.byteLength) });
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}

export async function GET(request = new Request("http://localhost/api/manual/file")) {
  try {
    const bytes = await getManualBytes();
    const range = parseRange(request.headers.get("range"), bytes.byteLength);
    const headers = buildPdfHeaders(bytes.byteLength);

    if (request.headers.has("range") && !range) {
      headers.set("Content-Range", `bytes */${bytes.byteLength}`);
      return new Response(null, { status: 416, headers });
    }

    if (range) {
      const body = bytes.subarray(range.start, range.end + 1);
      headers.set("Content-Length", String(body.byteLength));
      headers.set(
        "Content-Range",
        `bytes ${range.start}-${range.end}/${bytes.byteLength}`,
      );
      return new Response(responseBody(body), { status: 206, headers });
    }

    headers.set("Content-Length", String(bytes.byteLength));
    return new Response(responseBody(bytes), { status: 200, headers });
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}
