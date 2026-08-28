import { NextResponse } from "next/server";

import { maintenanceRepository } from "@/lib/data/maintenance-repository";
import { getMotorcycleOverview } from "@/lib/data/motorcycle-repository";
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
import type { DataScope } from "@/lib/server/data-scope";
import { OWNER_SCOPE } from "@/lib/server/owner-scope";
import { requireOwnerMode } from "@/lib/server/mutation-guard";
import { getReadableScope } from "@/lib/server/read-access";
import { readBoundedJson } from "@/lib/server/request-boundary";
import { assertSameOrigin } from "@/lib/server/same-origin";

export const runtime = "nodejs";

function validationError(error: MaintenanceRecordValidationError): AppError {
  return new AppError("INVALID_MAINTENANCE_RECORD", error.message, 400);
}

async function readJson(request: Request): Promise<unknown> {
  return readBoundedJson(request, {
    invalidCode: "INVALID_MAINTENANCE_RECORD",
    invalidMessage: "A JSON maintenance record body is required.",
    tooLargeMessage: "The maintenance record request is too large.",
  });
}

async function normalizeDefinitionSelection(
  scope: DataScope,
  definitionId: string | null,
): Promise<{ id: string; name: string } | null> {
  if (!definitionId) {
    return null;
  }

  const definitions = await maintenanceRepository.listActiveMaintenanceDefinitions(
    scope,
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
    const { scope } = await getReadableScope();
    const [overview, records, definitions] = await Promise.all([
      getMotorcycleOverview(scope),
      maintenanceRepository.listMaintenanceRecords(scope),
      maintenanceRepository.listActiveMaintenanceDefinitions(scope),
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
    requireOwnerMode();
    assertSameOrigin(request);
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

    const definition = await normalizeDefinitionSelection(OWNER_SCOPE, input.definitionId ?? null);
    const record = await maintenanceRepository.createMaintenanceRecord(
      OWNER_SCOPE,
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
