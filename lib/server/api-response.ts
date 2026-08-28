import "server-only";

import { NextResponse } from "next/server";

import { asAppError } from "@/lib/server/errors";

export function errorResponse(
  error: unknown,
  options: { cacheControl?: string } = {},
): NextResponse {
  const appError = asAppError(error);
  const headers = new Headers();
  if (options.cacheControl) {
    headers.set("Cache-Control", options.cacheControl);
  }
  if (appError.retryAfterSeconds !== null) {
    headers.set("Retry-After", String(appError.retryAfterSeconds));
  }

  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
      },
    },
    {
      status: appError.status,
      headers: headers.has("Cache-Control") || headers.has("Retry-After") ? headers : undefined,
    },
  );
}
