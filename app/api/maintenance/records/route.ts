import { NextResponse } from "next/server";

import { maintenanceRepository } from "@/lib/data/maintenance-repository";
import { MOTORCYCLE_ID, getMotorcycleOverview } from "@/lib/data/motorcycle-repository";
import {
  MaintenanceRecordValidationError,
  validateMaintenanceRecordInput,
} from "@/lib/domain/maintenance-records";
import {
  maintenanceHistoryResponseSchema,
  maintenanceRecordResponseSchema,
} from "@/lib/maintenance/maintenance-api-schemas";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

function validationError(error: MaintenanceRecordValidationError): AppError {
  return new AppError("INVALID_MAINTENANCE_RECORD", error.message, 400);
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

async function normalizeDefinitionSelection(
  definitionId: string | null,
): Promise<{ id: string; name: string } | null> {
  if (!definitionId) {
    return null;
  }

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

export async function GET() {
  try {
    const [overview, records, definitions] = await Promise.all([
      getMotorcycleOverview(),
      maintenanceRepository.listMaintenanceRecords(MOTORCYCLE_ID),
      maintenanceRepository.listActiveMaintenanceDefinitions(MOTORCYCLE_ID),
    ]);

    return NextResponse.json(
      maintenanceHistoryResponseSchema.parse({
        currentMileage: overview.motorcycle.currentMileage,
        definitions,
        records,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    let input;
    try {
      input = validateMaintenanceRecordInput(body);
    } catch (error) {
      if (error instanceof MaintenanceRecordValidationError) {
        throw validationError(error);
      }
      throw error;
    }

    const definition = await normalizeDefinitionSelection(input.definitionId ?? null);
    const record = await maintenanceRepository.createMaintenanceRecord(
      MOTORCYCLE_ID,
      definition
        ? { ...input, definitionId: definition.id, serviceType: definition.name }
        : input,
    );

    return NextResponse.json(
      maintenanceRecordResponseSchema.parse({ record }),
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
