import "server-only";

import { NextResponse } from "next/server";

import { asAppError } from "@/lib/server/errors";

export function errorResponse(error: unknown): NextResponse {
  const appError = asAppError(error);
  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
      },
    },
    { status: appError.status },
  );
}
