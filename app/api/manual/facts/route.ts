import { NextResponse } from "next/server";

import { manualRepository } from "@/lib/data/manual-repository";
import { MOTORCYCLE_ID } from "@/lib/data/motorcycle-repository";
import { manualApiError } from "@/lib/manual/manual-api-error";
import { manualFactsResponseSchema } from "@/lib/manual/manual-api-schemas";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
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
        "Maintenance facts are available after OCR processing reaches a complete state.",
        409,
      );
    }

    const response = manualFactsResponseSchema.parse({
      manualId: manual.id,
      facts: await manualRepository.listMaintenanceFacts(manual.id),
    });
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}
