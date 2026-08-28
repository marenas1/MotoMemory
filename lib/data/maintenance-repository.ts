import "server-only";

import { type QueryResultRow } from "pg";

import { getDatabasePool } from "@/lib/data/database";
import { executeOwnerSave } from "@/lib/data/owner-save-coordinator";
import {
  MaintenanceRecordValidationError,
  validateMaintenanceRecordInput,
  validateMaintenanceRecordUpdateInput,
  validatePerformedMileageAgainstCurrentMileage,
} from "@/lib/domain/maintenance-records";
import type {
  CreateMaintenanceRecordInput,
  MaintenanceDefinition,
  MaintenanceRecord,
  UpdateMaintenanceRecordInput,
} from "@/lib/domain/types";
import { buildManualCitationHref } from "@/lib/manual/manual-citations";
import type { DataScope } from "@/lib/server/data-scope";
import { AppError } from "@/lib/server/errors";

interface MaintenanceRecordRow extends QueryResultRow {
  id: string;
  motorcycle_id: string;
  definition_id: string | null;
  service_type: string;
  performed_mileage: string | number;
  performed_at: Date | string | null;
  notes: string | null;
  parts: string[] | null;
  cost: string | number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MotorcycleMileageRow extends QueryResultRow {
  current_mileage: string | number;
}

interface MaintenanceDefinitionRow extends QueryResultRow {
  id: string;
  motorcycle_id: string;
  name: string;
  interval_value: string | number | null;
  interval_unit: "mi" | "km" | null;
  interval_miles: string | number;
  due_window_miles: string | number;
  status: "active";
  source: string;
  notes: string | null;
  source_manual_id: string | null;
  source_page_start: number | null;
  source_page_end: number | null;
  source_printed_page_label: string | null;
  source_ocr_context: string | null;
  origin: "ocr" | "rider_corrected" | null;
  corrected_at: Date | string | null;
}

function parseDatabaseNumber(
  value: string | number,
  fieldName: string,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      `The database returned an invalid ${fieldName}.`,
    );
  }
  return parsed;
}

function parseDatabaseTimestamp(value: Date | string, fieldName: string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      `The database returned an invalid ${fieldName}.`,
    );
  }
  return parsed.toISOString();
}

function mapMaintenanceRecord(row: MaintenanceRecordRow): MaintenanceRecord {
  return {
    id: row.id,
    motorcycleId: row.motorcycle_id,
    definitionId: row.definition_id,
    serviceType: row.service_type,
    performedMileage: parseDatabaseNumber(
      row.performed_mileage,
      "performed mileage",
    ),
    performedAt:
      row.performed_at === null
        ? null
        : parseDatabaseTimestamp(row.performed_at, "performed date"),
    notes: row.notes,
    parts: row.parts,
    cost:
      row.cost === null
        ? null
        : parseDatabaseNumber(row.cost, "service cost"),
    createdAt: parseDatabaseTimestamp(row.created_at, "creation date"),
    updatedAt: parseDatabaseTimestamp(row.updated_at, "update date"),
  };
}

function mapMaintenanceDefinition(
  row: MaintenanceDefinitionRow,
): MaintenanceDefinition {
  return {
    id: row.id,
    motorcycleId: row.motorcycle_id,
    name: row.name,
    intervalValue:
      row.interval_value === null
        ? undefined
        : parseDatabaseNumber(row.interval_value, "maintenance interval"),
    intervalUnit: row.interval_unit ?? "mi",
    intervalMiles: parseDatabaseNumber(row.interval_miles, "maintenance interval"),
    dueWindowMiles: parseDatabaseNumber(row.due_window_miles, "maintenance due window"),
    status: row.status,
    source: row.source,
    notes: row.notes,
    sourceManualId: row.source_manual_id,
    sourcePageStart: row.source_page_start,
    sourcePageEnd: row.source_page_end,
    sourcePrintedPageLabel: row.source_printed_page_label,
    rawOcrContext: row.source_ocr_context,
    origin: row.origin,
    correctedAt:
      row.corrected_at === null
        ? null
        : parseDatabaseTimestamp(row.corrected_at, "correction date"),
    sourceHref:
      row.source_manual_id && row.source_page_start
        ? buildManualCitationHref(row.source_page_start, row.source_printed_page_label)
        : null,
  };
}

function maintenanceRecordColumns(): string {
  return `id, motorcycle_id, definition_id, service_type,
          performed_mileage, performed_at, notes, parts, cost,
          created_at, updated_at`;
}

function mapDatabaseError(
  error: unknown,
  operation: "read" | "write",
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof MaintenanceRecordValidationError) {
    return new AppError(
      "INVALID_MAINTENANCE_RECORD",
      error.message,
      400,
    );
  }

  const databaseError = error as { code?: string; constraint?: string };
  if (databaseError.code === "P0002") {
    return new AppError(
      "MOTORCYCLE_NOT_FOUND",
      "The motorcycle state was not found.",
      404,
    );
  }

  if (databaseError.code === "22023" || databaseError.code === "23514") {
    return new AppError(
      "INVALID_MAINTENANCE_RECORD",
      "The maintenance record contains an invalid value.",
      400,
    );
  }

  if (
    databaseError.code === "23503" &&
    databaseError.constraint?.includes("definition")
  ) {
    return new AppError(
      "MAINTENANCE_DEFINITION_NOT_FOUND",
      "The maintenance definition does not belong to this motorcycle.",
      404,
    );
  }

  if (
    databaseError.code === "23503" &&
    databaseError.constraint?.includes("motorcycle")
  ) {
    return new AppError(
      "MOTORCYCLE_NOT_FOUND",
      "The motorcycle state was not found.",
      404,
    );
  }

  return new AppError(
    operation === "read" ? "DATABASE_UNAVAILABLE" : "UPDATE_FAILED",
    operation === "read"
      ? "The maintenance history database is unavailable right now."
      : "The maintenance record could not be saved.",
    operation === "read" ? 503 : 500,
  );
}

function recordNotFound(): AppError {
  return new AppError(
    "MAINTENANCE_RECORD_NOT_FOUND",
    "The maintenance record was not found for this motorcycle.",
    404,
  );
}

export interface MaintenanceRecordRepository {
  listActiveMaintenanceDefinitions(
    scope: DataScope,
  ): Promise<MaintenanceDefinition[]>;
  listMaintenanceRecords(scope: DataScope): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord(
    scope: DataScope,
    input: CreateMaintenanceRecordInput,
  ): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(
    scope: DataScope,
    recordId: string,
    input: UpdateMaintenanceRecordInput,
  ): Promise<MaintenanceRecord>;
  deleteMaintenanceRecord(scope: DataScope, recordId: string): Promise<void>;
}

const postgresMaintenanceRecordRepository: MaintenanceRecordRepository = {
  async listActiveMaintenanceDefinitions(scope) {
    const motorcycleId = scope.motorcycleId;
    try {
      const result = await getDatabasePool().query<MaintenanceDefinitionRow>(
        `select id, motorcycle_id, name, interval_value, interval_unit,
                interval_miles, due_window_miles, status, source, notes,
                source_manual_id, source_page_start, source_page_end,
                source_printed_page_label, source_ocr_context, origin,
                corrected_at
           from public.maintenance_definitions
          where motorcycle_id = $1
            and status = 'active'
          order by interval_miles asc, name asc`,
        [motorcycleId],
      );

      return result.rows.map(mapMaintenanceDefinition);
    } catch (error) {
      throw mapDatabaseError(error, "read");
    }
  },

  async listMaintenanceRecords(scope) {
    const motorcycleId = scope.motorcycleId;
    try {
      const result = await getDatabasePool().query<MaintenanceRecordRow>(
        `select ${maintenanceRecordColumns()}
           from public.maintenance_records
          where motorcycle_id = $1
          order by performed_mileage desc, performed_at desc nulls last,
                   created_at desc, id desc`,
        [motorcycleId],
      );

      return result.rows.map(mapMaintenanceRecord);
    } catch (error) {
      throw mapDatabaseError(error, "read");
    }
  },

  async createMaintenanceRecord(scope, input) {
    const motorcycleId = scope.motorcycleId;
    try {
      const normalized = validateMaintenanceRecordInput(input);
      return await executeOwnerSave(scope, async (client) => {
        const motorcycleResult = await client.query<MotorcycleMileageRow>(
          `select current_mileage
             from public.motorcycle_state
            where id = $1
            for update`,
          [motorcycleId],
        );
        const motorcycle = motorcycleResult.rows[0];
        if (!motorcycle) {
          throw new AppError(
            "MOTORCYCLE_NOT_FOUND",
            "The motorcycle state was not found.",
            404,
          );
        }

        const currentMileage = parseDatabaseNumber(
          motorcycle.current_mileage,
          "current mileage",
        );
        validatePerformedMileageAgainstCurrentMileage(
          Number(normalized.performedMileage),
          currentMileage,
        );

        const result = await client.query<MaintenanceRecordRow>(
          `insert into public.maintenance_records (
             motorcycle_id, definition_id, service_type, performed_mileage,
             performed_at, notes, parts, cost
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning ${maintenanceRecordColumns()}`,
          [
            motorcycleId,
            normalized.definitionId,
            normalized.serviceType,
            normalized.performedMileage,
            normalized.performedAt,
            normalized.notes,
            normalized.parts,
            normalized.cost,
          ],
        );
        const row = result.rows[0];
        if (!row) {
          throw new AppError(
            "UPDATE_FAILED",
            "The maintenance record was not returned after saving.",
          );
        }

        return { result: mapMaintenanceRecord(row), changed: true };
      });
    } catch (error) {
      throw mapDatabaseError(error, "write");
    }
  },

  async updateMaintenanceRecord(scope, recordId, input) {
    const motorcycleId = scope.motorcycleId;
    try {
      const normalizedUpdate = validateMaintenanceRecordUpdateInput(input);
      return await executeOwnerSave(scope, async (client) => {
        const motorcycleResult = await client.query<MotorcycleMileageRow>(
          `select current_mileage
             from public.motorcycle_state
            where id = $1
            for update`,
          [motorcycleId],
        );
        const motorcycle = motorcycleResult.rows[0];
        if (!motorcycle) {
          throw new AppError(
            "MOTORCYCLE_NOT_FOUND",
            "The motorcycle state was not found.",
            404,
          );
        }

        const currentResult = await client.query<MaintenanceRecordRow>(
          `select ${maintenanceRecordColumns()}
             from public.maintenance_records
            where id = $1
            and motorcycle_id = $2
            for update`,
          [recordId, motorcycleId],
        );
        const currentRow = currentResult.rows[0];
        if (!currentRow) {
          throw recordNotFound();
        }

        const current = mapMaintenanceRecord(currentRow);
        const merged = validateMaintenanceRecordInput({
          definitionId:
            normalizedUpdate.definitionId === undefined
              ? current.definitionId
              : normalizedUpdate.definitionId,
          serviceType: normalizedUpdate.serviceType ?? current.serviceType,
          performedMileage:
            normalizedUpdate.performedMileage ?? current.performedMileage,
          performedAt:
            normalizedUpdate.performedAt === undefined
              ? current.performedAt
              : normalizedUpdate.performedAt,
          notes:
            normalizedUpdate.notes === undefined
              ? current.notes
              : normalizedUpdate.notes,
          parts:
            normalizedUpdate.parts === undefined
              ? current.parts
              : normalizedUpdate.parts,
          cost:
            normalizedUpdate.cost === undefined
              ? current.cost
              : normalizedUpdate.cost,
        });

        const currentMileage = parseDatabaseNumber(
          motorcycle.current_mileage,
          "current mileage",
        );
        validatePerformedMileageAgainstCurrentMileage(
          Number(merged.performedMileage),
          currentMileage,
        );

        const result = await client.query<MaintenanceRecordRow>(
          `update public.maintenance_records
              set definition_id = $3,
                  service_type = $4,
                  performed_mileage = $5,
                  performed_at = $6,
                  notes = $7,
                  parts = $8,
                  cost = $9,
                  updated_at = now()
            where id = $1
            and motorcycle_id = $2
            returning ${maintenanceRecordColumns()}`,
          [
            recordId,
            motorcycleId,
            merged.definitionId,
            merged.serviceType,
            merged.performedMileage,
            merged.performedAt,
            merged.notes,
            merged.parts,
            merged.cost,
          ],
        );
        const row = result.rows[0];
        if (!row) {
          throw new AppError(
            "UPDATE_FAILED",
            "The maintenance record was not returned after updating.",
          );
        }

        return { result: mapMaintenanceRecord(row), changed: true };
      });
    } catch (error) {
      throw mapDatabaseError(error, "write");
    }
  },

  async deleteMaintenanceRecord(scope, recordId) {
    const motorcycleId = scope.motorcycleId;
    try {
      await executeOwnerSave(scope, async (client) => {
        const result = await client.query<{ id: string }>(
          `delete from public.maintenance_records
            where id = $1
            and motorcycle_id = $2
            returning id`,
          [recordId, motorcycleId],
        );
        if (!result.rows[0]) {
          throw recordNotFound();
        }
        return { result: undefined, changed: true };
      });
    } catch (error) {
      throw mapDatabaseError(error, "write");
    }
  },
};

export const maintenanceRepository = postgresMaintenanceRecordRepository;
