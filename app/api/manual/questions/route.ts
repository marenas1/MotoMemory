import { NextResponse } from "next/server";

import { manualRepository } from "@/lib/data/manual-repository";
import { MOTORCYCLE_ID } from "@/lib/data/motorcycle-repository";
import { manualApiError } from "@/lib/manual/manual-api-error";
import {
  manualQuestionRequestSchema,
  manualQuestionResponseSchema,
} from "@/lib/manual/manual-api-schemas";
import { answerManualQuestion } from "@/lib/manual/manual-answering";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("INVALID_MANUAL", "A JSON question body is required.", 400);
    }

    const parsedBody = manualQuestionRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new AppError(
        "INVALID_MANUAL",
        "Question body must contain only a non-empty question of 500 characters or fewer.",
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
        "Manual questions are available after OCR processing reaches a complete state.",
        409,
      );
    }

    const response = await answerManualQuestion(
      manual,
      parsedBody.data.question,
    );

    return NextResponse.json(manualQuestionResponseSchema.parse(response));
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}
