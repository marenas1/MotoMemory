import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { maintenanceRepository } from "@/lib/data/maintenance-repository";
import { calculateMaintenanceOutlooks } from "@/lib/domain/maintenance";
import type {
  MaintenanceDefinition,
  MotorcycleOverview,
  MotorcycleState,
} from "@/lib/domain/types";
import { buildManualCitationHref } from "@/lib/manual/manual-citations";
import { AppError } from "@/lib/server/errors";

export const MOTORCYCLE_ID = "gs750";

type MotorcycleRow = QueryResultRow & {
  id: string;
  make: string;
  model: string;
  model_year: number;
  current_mileage: string;
  mileage_unit: "mi";
  visual_state: "emoji" | "image";
  visual_emoji: string | null;
  last_mileage_update_at: Date | null;
  last_mileage_update_origin: "manual" | null;
  updated_at: Date;
};

type MaintenanceRow = QueryResultRow & {
  id: string;
  motorcycle_id: string;
  name: string;
  interval_value: string | null;
  interval_unit: "mi" | "km" | null;
  interval_miles: string;
  due_window_miles: string;
  status: "active";
  source: string;
  notes: string | null;
  source_manual_id: string | null;
  source_page_start: number | null;
  source_page_end: number | null;
  source_printed_page_label: string | null;
  source_ocr_context: string | null;
  origin: "ocr" | "rider_corrected" | null;
  corrected_at: Date | null;
};

type UpdateRow = QueryResultRow & {
  motorcycle_id: string;
  previous_mileage: string;
  current_mileage: string;
  changed: boolean;
  updated_at: Date;
  last_mileage_update_origin: "manual" | null;
};

let pool: Pool | undefined;

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      "DATABASE_URL is not configured for the local app.",
      503,
    );
  }

  pool ??= new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

  return pool;
}

function parseNumeric(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      "The database returned an invalid numeric value.",
    );
  }
  return parsed;
}

function mapMotorcycle(row: MotorcycleRow): MotorcycleState {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    modelYear: row.model_year,
    currentMileage: parseNumeric(row.current_mileage),
    mileageUnit: row.mileage_unit,
    visualState: row.visual_state,
    visualEmoji: row.visual_emoji,
    lastMileageUpdateAt: row.last_mileage_update_at?.toISOString() ?? null,
    lastMileageUpdateOrigin: row.last_mileage_update_origin,
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMaintenance(row: MaintenanceRow): MaintenanceDefinition {
  return {
    id: row.id,
    motorcycleId: row.motorcycle_id,
    name: row.name,
    intervalValue:
      row.interval_value === null ? undefined : parseNumeric(row.interval_value),
    intervalUnit: row.interval_unit ?? "mi",
    intervalMiles: parseNumeric(row.interval_miles),
    dueWindowMiles: parseNumeric(row.due_window_miles),
    status: row.status,
    source: row.source,
    notes: row.notes,
    sourceManualId: row.source_manual_id,
    sourcePageStart: row.source_page_start,
    sourcePageEnd: row.source_page_end,
    sourcePrintedPageLabel: row.source_printed_page_label,
    rawOcrContext: row.source_ocr_context,
    origin: row.origin,
    correctedAt: row.corrected_at?.toISOString() ?? null,
    sourceHref:
      row.source_manual_id && row.source_page_start
        ? buildManualCitationHref(row.source_page_start, row.source_printed_page_label)
        : null,
  };
}

function mapDatabaseError(error: unknown, operation: "read" | "update"): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const databaseError = error as { code?: string };
  if (databaseError.code === "P0002") {
    return new AppError(
      "MOTORCYCLE_NOT_FOUND",
      "The GS750 motorcycle state was not found.",
      404,
    );
  }

  if (databaseError.code === "22023") {
    return new AppError(
      "INVALID_MILEAGE",
      "Mileage must be zero or greater.",
      400,
    );
  }

  return new AppError(
    operation === "read" ? "DATABASE_UNAVAILABLE" : "UPDATE_FAILED",
    operation === "read"
      ? "The motorcycle database is unavailable right now."
      : "The mileage update could not be saved.",
    operation === "read" ? 503 : 500,
  );
}

export interface MotorcycleRepository {
  getOverview(motorcycleId: string): Promise<MotorcycleOverview>;
  updateMileage(
    motorcycleId: string,
    mileage: number,
    expectedCurrentMileage?: number,
  ): Promise<MotorcycleOverview>;
}

const postgresRepository: MotorcycleRepository = {
  async getOverview(motorcycleId) {
    try {
      const database = getPool();
      const motorcycleResult = await database.query<MotorcycleRow>(
        `select id, make, model, model_year, current_mileage, mileage_unit,
                visual_state, visual_emoji, last_mileage_update_at,
                last_mileage_update_origin, updated_at
           from public.motorcycle_state
          where id = $1`,
        [motorcycleId],
      );

      const motorcycleRow = motorcycleResult.rows[0];
      if (!motorcycleRow) {
        throw new AppError(
          "MOTORCYCLE_NOT_FOUND",
          "The GS750 motorcycle state was not found.",
          404,
        );
      }

      const maintenanceResult = await database.query<MaintenanceRow>(
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

      const motorcycle = mapMotorcycle(motorcycleRow);
      const definitions = maintenanceResult.rows.map(mapMaintenance);
      const records = await maintenanceRepository.listMaintenanceRecords(
        motorcycleId,
      );

      return {
        motorcycle,
        maintenanceOutlook: calculateMaintenanceOutlooks(
          motorcycle.currentMileage,
          definitions,
          records,
        ),
      };
    } catch (error) {
      throw mapDatabaseError(error, "read");
    }
  },

  async updateMileage(motorcycleId, mileage, expectedCurrentMileage) {
    let client: PoolClient | undefined;

    try {
      const database = getPool();
      client = await database.connect();
      await client.query("begin");

      const currentResult = await client.query<{ current_mileage: string }>(
        `select current_mileage
           from public.motorcycle_state
          where id = $1
          for update`,
        [motorcycleId],
      );

      const currentRow = currentResult.rows[0];
      if (!currentRow) {
        throw new AppError(
          "MOTORCYCLE_NOT_FOUND",
          "The GS750 motorcycle state was not found.",
          404,
        );
      }

      const currentMileage = parseNumeric(currentRow.current_mileage);
      if (
        expectedCurrentMileage !== undefined &&
        expectedCurrentMileage !== currentMileage
      ) {
        throw new AppError(
          "STALE_STATE",
          "The motorcycle state changed before this update. Refresh and try again.",
          409,
        );
      }

      const updateResult = await client.query<UpdateRow>(
        `select motorcycle_id, previous_mileage, current_mileage, changed,
                updated_at, last_mileage_update_origin
           from public.update_motorcycle_mileage($1, $2, 'manual')`,
        [motorcycleId, mileage],
      );

      if (!updateResult.rows[0]) {
        throw new AppError(
          "UPDATE_FAILED",
          "The mileage update did not return a saved state.",
        );
      }

      await client.query("commit");
    } catch (error) {
      if (client) {
        await client.query("rollback").catch(() => undefined);
      }
      throw mapDatabaseError(error, "update");
    } finally {
      client?.release();
    }

    return this.getOverview(motorcycleId);
  },
};

export const motorcycleRepository = postgresRepository;

export async function getMotorcycleOverview(): Promise<MotorcycleOverview> {
  return motorcycleRepository.getOverview(MOTORCYCLE_ID);
}
