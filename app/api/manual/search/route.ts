import { NextResponse } from "next/server";

import { manualRepository } from "@/lib/data/manual-repository";
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
import { getReadableScope } from "@/lib/server/read-access";
import { enforcePublicRateLimit } from "@/lib/server/public-rate-limit";
import { readBoundedJson } from "@/lib/server/request-boundary";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const access = await getReadableScope();
    if (!access.isOwner) {
      await enforcePublicRateLimit(request, "manual_search");
    }
    const scope = access.scope;
    const body = await readBoundedJson(request, {
      invalidCode: "INVALID_MANUAL",
      invalidMessage: "A JSON search body is required.",
      tooLargeMessage: "The manual search body is too large.",
    });

    const parsedBody = manualSearchRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new AppError(
        "INVALID_MANUAL",
        "Search body must contain a query and may contain only a numeric limit.",
        400,
      );
    }

    const manual = await manualRepository.findCurrent(scope);
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
      scope,
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
