import { NextResponse } from "next/server";

import { manualRepository } from "@/lib/data/manual-repository";
import { manualApiError } from "@/lib/manual/manual-api-error";
import {
  manualQuestionRequestSchema,
  manualQuestionResponseSchema,
} from "@/lib/manual/manual-api-schemas";
import { answerManualQuestion } from "@/lib/manual/manual-answering";
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
      await enforcePublicRateLimit(request, "manual_question");
    }
    const scope = access.scope;
    const body = await readBoundedJson(request, {
      invalidCode: "INVALID_MANUAL",
      invalidMessage: "A JSON question body is required.",
      tooLargeMessage: "The manual question body is too large.",
    });

    const parsedBody = manualQuestionRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new AppError(
        "INVALID_MANUAL",
        "Question body must contain only a non-empty question of 500 characters or fewer.",
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
        "Manual questions are available after OCR processing reaches a complete state.",
        409,
      );
    }

    const response = await answerManualQuestion(
      scope,
      manual,
      parsedBody.data.question,
    );

    return NextResponse.json(manualQuestionResponseSchema.parse(response));
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}
