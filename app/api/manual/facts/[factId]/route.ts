import { NextResponse } from "next/server";

import { manualRepository } from "@/lib/data/manual-repository";
import { getMotorcycleOverview } from "@/lib/data/motorcycle-repository";
import { manualApiError } from "@/lib/manual/manual-api-error";
import {
  manualFactCorrectionRequestSchema,
  manualFactCorrectionResponseSchema,
} from "@/lib/manual/manual-api-schemas";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";
import { OWNER_SCOPE } from "@/lib/server/owner-scope";
import { requireOwnerMode } from "@/lib/server/mutation-guard";
import { readBoundedJson } from "@/lib/server/request-boundary";
import { assertSameOrigin } from "@/lib/server/same-origin";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ factId: string }> },
) {
  try {
    requireOwnerMode();
    assertSameOrigin(request);
    const { factId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(factId)) {
      throw new AppError("INVALID_MANUAL", "The maintenance fact ID is invalid.", 400);
    }

    const body = await readBoundedJson(request, {
      invalidCode: "INVALID_MANUAL",
      invalidMessage: "A JSON correction body is required.",
      tooLargeMessage: "The maintenance fact correction is too large.",
    });

    const parsedBody = manualFactCorrectionRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new AppError(
        "INVALID_MANUAL",
        "Correction body must contain a valid task, interval, unit, or note field.",
        400,
      );
    }

    const manual = await manualRepository.findCurrent(OWNER_SCOPE);
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
      OWNER_SCOPE,
      manual.id,
      factId,
      parsedBody.data,
    );
    const overview = await getMotorcycleOverview(OWNER_SCOPE);

    return NextResponse.json(manualFactCorrectionResponseSchema.parse({
      fact,
      maintenanceOutlook: overview.maintenanceOutlook,
    }));
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}
