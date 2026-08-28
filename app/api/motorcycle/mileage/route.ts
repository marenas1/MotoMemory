import { NextResponse } from "next/server";

import { motorcycleRepository } from "@/lib/data/motorcycle-repository";
import { validateMileageInput } from "@/lib/domain/mileage";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";
import { OWNER_SCOPE } from "@/lib/server/owner-scope";
import { requireOwnerMode } from "@/lib/server/mutation-guard";
import { readBoundedJson } from "@/lib/server/request-boundary";
import { assertSameOrigin } from "@/lib/server/same-origin";

export async function PATCH(request: Request) {
  try {
    requireOwnerMode();
    assertSameOrigin(request);
    const body: unknown = await readBoundedJson(request, {
      invalidCode: "INVALID_MILEAGE",
      invalidMessage: "A JSON mileage body is required.",
      tooLargeMessage: "The mileage request is too large.",
    });
    const bodyObject = typeof body === "object" && body !== null ? body : {};
    const mileage = validateMileageInput(
      "mileage" in bodyObject ? bodyObject.mileage : undefined,
    );
    const expectedCurrentMileage =
      "expectedCurrentMileage" in bodyObject
        ? validateMileageInput(bodyObject.expectedCurrentMileage)
        : undefined;

    return NextResponse.json(
      await motorcycleRepository.updateMileage(
        OWNER_SCOPE,
        mileage,
        expectedCurrentMileage,
      ),
    );
  } catch (error) {
    if (error instanceof Error && !(error instanceof AppError)) {
      return errorResponse(
        new AppError("INVALID_MILEAGE", error.message, 400),
      );
    }
    return errorResponse(error);
  }
}
