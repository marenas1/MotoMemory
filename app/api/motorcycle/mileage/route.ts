import { NextResponse } from "next/server";

import { motorcycleRepository } from "@/lib/data/motorcycle-repository";
import { validateMileageInput } from "@/lib/domain/mileage";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
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
        "gs750",
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
