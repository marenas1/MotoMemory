import { NextResponse } from "next/server";

import { manualRepository } from "@/lib/data/manual-repository";
import { MOTORCYCLE_ID } from "@/lib/data/motorcycle-repository";
import { manualApiError } from "@/lib/manual/manual-api-error";
import {
  manualSearchRequestSchema,
  manualSearchResponseSchema,
} from "@/lib/manual/manual-api-schemas";
import {
  isPassageWithinManual,
  toManualPassage,
} from "@/lib/manual/manual-citations";
import { toManualIdentity } from "@/lib/manual/manual-presenter";
import { searchManualChunks } from "@/lib/manual/retrieval";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("INVALID_MANUAL", "A JSON search body is required.", 400);
    }

    const parsedBody = manualSearchRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new AppError(
        "INVALID_MANUAL",
        "Search body must contain a query and may contain only a numeric limit.",
        400,
      );
    }

    const manual = await manualRepository.findCurrent(MOTORCYCLE_ID);
    if (!manual) {
      throw new AppError(
        "MANUAL_NOT_FOUND",
        "No manual is uploaded for the GS750.",
        404,
      );
    }

    if (manual.status !== "ready") {
      throw new AppError(
        "MANUAL_PROCESSING",
        "Manual search is available after OCR processing reaches a complete state.",
        409,
      );
    }

    const passages = (await searchManualChunks(
      manual.id,
      parsedBody.data.query,
      { repository: manualRepository },
      parsedBody.data.limit,
    )).filter((passage) =>
      isPassageWithinManual(passage, manual.id, manual.pageCount),
    );

    return NextResponse.json(
      manualSearchResponseSchema.parse({
        manualId: manual.id,
        manual: toManualIdentity(manual),
        passages: passages.map(toManualPassage),
      }),
    );
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}
