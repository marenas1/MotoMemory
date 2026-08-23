import { NextResponse } from "next/server";

import { manualRepository } from "@/lib/data/manual-repository";
import { MOTORCYCLE_ID, getMotorcycleOverview } from "@/lib/data/motorcycle-repository";
import { manualApiError } from "@/lib/manual/manual-api-error";
import {
  manualFactCorrectionRequestSchema,
  manualFactCorrectionResponseSchema,
} from "@/lib/manual/manual-api-schemas";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ factId: string }> },
) {
  try {
    const { factId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(factId)) {
      throw new AppError("INVALID_MANUAL", "The maintenance fact ID is invalid.", 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("INVALID_MANUAL", "A JSON correction body is required.", 400);
    }

    const parsedBody = manualFactCorrectionRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new AppError(
        "INVALID_MANUAL",
        "Correction body must contain a valid task, interval, unit, or note field.",
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
        "Maintenance facts can be corrected after OCR processing reaches a complete state.",
        409,
      );
    }

    const fact = await manualRepository.correctMaintenanceFact(
      MOTORCYCLE_ID,
      manual.id,
      factId,
      parsedBody.data,
    );
    const overview = await getMotorcycleOverview();

    return NextResponse.json(manualFactCorrectionResponseSchema.parse({
      fact,
      maintenanceOutlook: overview.maintenanceOutlook,
    }));
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}
