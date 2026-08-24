import { NextResponse } from "next/server";

import { maintenanceRepository } from "@/lib/data/maintenance-repository";
import { MOTORCYCLE_ID } from "@/lib/data/motorcycle-repository";
import {
  MaintenanceRecordValidationError,
  validateMaintenanceRecordUpdateInput,
} from "@/lib/domain/maintenance-records";
import { maintenanceRecordResponseSchema } from "@/lib/maintenance/maintenance-api-schemas";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

async function normalizeDefinitionSelection(
  definitionId: string,
): Promise<{ id: string; name: string }> {
  const definitions = await maintenanceRepository.listActiveMaintenanceDefinitions(
    MOTORCYCLE_ID,
  );
  const definition = definitions.find((item) => item.id === definitionId);
  if (!definition) {
    throw new AppError(
      "MAINTENANCE_DEFINITION_NOT_FOUND",
      "Choose an active maintenance item for this motorcycle, or choose Other / unlinked.",
      404,
    );
  }

  return { id: definition.id, name: definition.name };
}

function assertRecordId(recordId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recordId)) {
    throw new AppError("INVALID_MAINTENANCE_RECORD", "The maintenance record ID is invalid.", 400);
  }

  return recordId;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(
      "INVALID_MAINTENANCE_RECORD",
      "A JSON maintenance record body is required.",
      400,
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId: rawRecordId } = await params;
    const recordId = assertRecordId(rawRecordId);
    const body = await readJson(request);
    let input;
    try {
      input = validateMaintenanceRecordUpdateInput(body);
    } catch (error) {
      if (error instanceof MaintenanceRecordValidationError) {
        throw new AppError("INVALID_MAINTENANCE_RECORD", error.message, 400);
      }
      throw error;
    }

    const definition =
      input.definitionId === undefined || input.definitionId === null
        ? null
        : await normalizeDefinitionSelection(input.definitionId);
    const normalizedInput = definition
      ? { ...input, definitionId: definition.id, serviceType: definition.name }
      : input;

    const record = await maintenanceRepository.updateMaintenanceRecord(
      MOTORCYCLE_ID,
      recordId,
      normalizedInput,
    );
    return NextResponse.json(maintenanceRecordResponseSchema.parse({ record }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId: rawRecordId } = await params;
    const recordId = assertRecordId(rawRecordId);
    await maintenanceRepository.deleteMaintenanceRecord(MOTORCYCLE_ID, recordId);
    return NextResponse.json({ deletedId: recordId });
  } catch (error) {
    return errorResponse(error);
  }
}
