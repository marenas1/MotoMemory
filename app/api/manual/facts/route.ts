import { NextResponse } from "next/server";

import { manualRepository } from "@/lib/data/manual-repository";
import { manualApiError } from "@/lib/manual/manual-api-error";
import { manualFactsResponseSchema } from "@/lib/manual/manual-api-schemas";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";
import { getReadableScope } from "@/lib/server/read-access";

export const runtime = "nodejs";

// Fact corrections are handled by the guarded [factId] PATCH route; this
// collection route intentionally remains a live read endpoint.
export async function GET() {
  try {
    const { scope } = await getReadableScope();
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
        "Maintenance facts are available after OCR processing reaches a complete state.",
        409,
      );
    }

    const response = manualFactsResponseSchema.parse({
      manualId: manual.id,
      facts: await manualRepository.listMaintenanceFacts(scope, manual.id),
    });
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}
