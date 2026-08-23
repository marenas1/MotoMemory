import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import type {
  ManualChunkInput,
  ManualChunkRecord,
  ManualDocumentRecord,
  ManualDocumentStatus,
  ManualIngestionProgress,
  ManualMaintenanceFactInput,
  ManualMaintenanceFactRecord,
  MaintenanceFactCorrectionInput,
  ManualPageRecord,
  ManualPageFailure,
  ManualPageUpsertInput,
} from "@/lib/manual/manual-types";
import { buildManualCitationHref } from "@/lib/manual/manual-citations";
import { normalizeMaintenanceFactCorrection } from "@/lib/manual/manual-facts";
import {
  type ManualMetadataInput,
  ManualValidationError,
  validateManualMetadata,
  validateManualSha256,
  validateManualStorageKey,
} from "@/lib/manual/manual-validation";
import { AppError } from "@/lib/server/errors";

export interface CreateManualDocumentInput extends ManualMetadataInput {
  id: string;
  motorcycleId: string;
  storageKey: string;
}

interface ManualDocumentRow extends QueryResultRow {
  id: string;
  motorcycle_id: string;
  file_name: string;
  content_type: "application/pdf";
  storage_key: string;
  file_size_bytes: string;
  sha256: string;
  page_count: number;
  status: ManualDocumentStatus;
  extraction_method: "ocr";
  error_message: string | null;
  uploaded_at: Date;
  processed_at: Date | null;
}

interface ManualPageRow extends QueryResultRow {
  id: string;
  manual_id: string;
  page_number: number;
  printed_page_label: string | null;
  extracted_text: string | null;
  extraction_status: "available" | "failed";
  error_message: string | null;
  ocr_engine: string | null;
  processed_at: Date | null;
}

interface ManualChunkRow extends QueryResultRow {
  id: string;
  manual_id: string;
  page_start: number;
  page_end: number;
  printed_page_start: string | null;
  printed_page_end: string | null;
  section_label: string | null;
  content: string;
  processor_version: string | null;
  rank?: number;
}

interface MaintenanceRow extends QueryResultRow {
  id: string;
  motorcycle_id: string;
  name: string;
  interval_value: string;
  interval_unit: "mi" | "km";
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
}

interface ManualProgressRow extends QueryResultRow {
  total_pages: number;
  accounted_pages: string;
  available_pages: string;
  failed_pages: string;
}

interface ManualPageFailureRow extends QueryResultRow {
  page_number: number;
  error_message: string | null;
}

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
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      "The database returned an invalid manual file size.",
    );
  }
  return parsed;
}

function parsePositiveNumber(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      "The database returned an invalid maintenance interval.",
    );
  }
  return parsed;
}

function parseNonNegativeNumber(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      "The database returned an invalid maintenance window.",
    );
  }
  return parsed;
}

function mapManualDocument(row: ManualDocumentRow): ManualDocumentRecord {
  return {
    id: row.id,
    motorcycleId: row.motorcycle_id,
    fileName: row.file_name,
    contentType: row.content_type,
    storageKey: row.storage_key,
    fileSizeBytes: parseNumeric(row.file_size_bytes),
    sha256: row.sha256,
    pageCount: row.page_count,
    status: row.status,
    extractionMethod: row.extraction_method,
    errorMessage: row.error_message,
    uploadedAt: row.uploaded_at.toISOString(),
    processedAt: row.processed_at?.toISOString() ?? null,
  };
}

function mapManualPage(row: ManualPageRow): ManualPageRecord {
  return {
    id: row.id,
    manualId: row.manual_id,
    pageNumber: row.page_number,
    printedPageLabel: row.printed_page_label,
    extractedText: row.extracted_text,
    extractionStatus: row.extraction_status,
    errorMessage: row.error_message,
    ocrEngine: row.ocr_engine,
    processedAt: row.processed_at?.toISOString() ?? null,
  };
}

function mapManualChunk(row: ManualChunkRow): ManualChunkRecord {
  return {
    id: row.id,
    manualId: row.manual_id,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    printedPageStart: row.printed_page_start,
    printedPageEnd: row.printed_page_end,
    sectionLabel: row.section_label,
    content: row.content,
    processorVersion: row.processor_version,
    ...(row.rank === undefined ? {} : { rank: Number(row.rank) }),
  };
}

function mapMaintenanceFact(row: MaintenanceRow): ManualMaintenanceFactRecord {
  if (!row.source_manual_id || !row.source_page_start || !row.source_page_end || !row.origin) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      "The database returned a maintenance fact without complete source provenance.",
    );
  }

  return {
    id: row.id,
    motorcycleId: row.motorcycle_id,
    name: row.name,
    intervalValue: parsePositiveNumber(row.interval_value),
    intervalUnit: row.interval_unit,
    intervalMiles: parsePositiveNumber(row.interval_miles),
    dueWindowMiles: parseNonNegativeNumber(row.due_window_miles),
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
    sourceHref: buildManualCitationHref(
      row.source_page_start,
      row.source_printed_page_label,
    ),
  };
}

function maintenanceFactColumns(): string {
  return `id, motorcycle_id, name, interval_value, interval_unit,
          interval_miles, due_window_miles, status, source, notes,
          source_manual_id, source_page_start, source_page_end,
          source_printed_page_label, source_ocr_context, origin, corrected_at`;
}

function parseCount(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      "The database returned an invalid manual ingestion count.",
    );
  }
  return parsed;
}

function mapManualProgress(
  row: ManualProgressRow,
  failures: ManualPageFailure[],
): ManualIngestionProgress {
  const totalPages = Number(row.total_pages);
  const accountedPages = parseCount(row.accounted_pages);
  const availablePages = parseCount(row.available_pages);
  const failedPages = parseCount(row.failed_pages);

  if (!Number.isSafeInteger(totalPages) || totalPages < 1) {
    throw new AppError(
      "INVALID_CONFIGURATION",
      "The database returned an invalid manual page count.",
    );
  }

  const pendingPages = Math.max(0, totalPages - accountedPages);
  return {
    totalPages,
    accountedPages,
    availablePages,
    failedPages,
    pendingPages,
    percentComplete: Math.floor((accountedPages / totalPages) * 100),
    failures,
  };
}

export interface ManualRepository {
  findById(documentId: string): Promise<ManualDocumentRecord | null>;
  findCurrent(motorcycleId: string): Promise<ManualDocumentRecord | null>;
  findBySha256(
    motorcycleId: string,
    sha256: string,
  ): Promise<ManualDocumentRecord | null>;
  createDocument(input: CreateManualDocumentInput): Promise<ManualDocumentRecord>;
  deleteDocument(documentId: string): Promise<void>;
  beginProcessing(documentId: string): Promise<ManualDocumentRecord | null>;
  markReady(documentId: string): Promise<ManualDocumentRecord | null>;
  markFailed(
    documentId: string,
    errorMessage: string,
  ): Promise<ManualDocumentRecord | null>;
  listPages(manualId: string): Promise<ManualPageRecord[]>;
  savePageWithChunks(
    manualId: string,
    page: ManualPageUpsertInput,
    chunks: ManualChunkInput[],
  ): Promise<ManualPageRecord>;
  getIngestionProgress(manualId: string): Promise<ManualIngestionProgress>;
  searchChunks(
    manualId: string,
    query: string,
    limit: number,
  ): Promise<ManualChunkRecord[]>;
  listMaintenanceFacts(manualId: string): Promise<ManualMaintenanceFactRecord[]>;
  upsertManualMaintenanceFacts(
    motorcycleId: string,
    manualId: string,
    facts: ManualMaintenanceFactInput[],
  ): Promise<ManualMaintenanceFactRecord[]>;
  correctMaintenanceFact(
    motorcycleId: string,
    manualId: string,
    factId: string,
    input: MaintenanceFactCorrectionInput,
  ): Promise<ManualMaintenanceFactRecord>;
}

type ManualDatabaseErrorContext = Record<
  string,
  boolean | number | string | null | undefined
>;

function logManualDatabaseError(
  error: unknown,
  operation: "read" | "write",
  context?: ManualDatabaseErrorContext,
): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const databaseError = error as {
    code?: string;
    constraint?: string;
    table?: string;
    column?: string;
  };

  console.error("[MotoMemory] Manual database operation failed", {
    operation,
    ...context,
    code: databaseError.code,
    constraint: databaseError.constraint,
    table: databaseError.table,
    column: databaseError.column,
    message: error instanceof Error ? error.message : String(error),
  });
}

function mapManualDatabaseError(
  error: unknown,
  operation: "read" | "write",
  context?: ManualDatabaseErrorContext,
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ManualValidationError) {
    throw error;
  }

  logManualDatabaseError(error, operation, context);

  const databaseError = error as { code?: string; constraint?: string };
  if (databaseError.code === "23505") {
    if (databaseError.constraint?.includes("sha256")) {
      return new AppError(
        "MANUAL_DUPLICATE",
        "An identical manual is already uploaded for the GS750.",
        409,
      );
    }

    if (databaseError.constraint?.includes("motorcycle")) {
      return new AppError(
        "MANUAL_ALREADY_EXISTS",
        "A manual is already uploaded for the GS750.",
        409,
      );
    }
  }

  return new AppError(
    operation === "read" ? "DATABASE_UNAVAILABLE" : "UPDATE_FAILED",
    operation === "read"
      ? "The manual database is unavailable right now."
      : "The manual record could not be saved.",
    operation === "read" ? 503 : 500,
  );
}

const postgresManualRepository: ManualRepository = {
  async findById(documentId) {
    try {
      const result = await getPool().query<ManualDocumentRow>(
        `select id, motorcycle_id, file_name, content_type, storage_key,
                file_size_bytes, sha256, page_count, status, extraction_method,
                error_message, uploaded_at, processed_at
           from public.manual_documents
          where id = $1
          limit 1`,
        [documentId],
      );

      return result.rows[0] ? mapManualDocument(result.rows[0]) : null;
    } catch (error) {
      throw mapManualDatabaseError(error, "read");
    }
  },

  async findCurrent(motorcycleId) {
    try {
      const result = await getPool().query<ManualDocumentRow>(
        `select id, motorcycle_id, file_name, content_type, storage_key,
                file_size_bytes, sha256, page_count, status, extraction_method,
                error_message, uploaded_at, processed_at
           from public.manual_documents
          where motorcycle_id = $1
          order by uploaded_at desc
          limit 1`,
        [motorcycleId],
      );

      return result.rows[0] ? mapManualDocument(result.rows[0]) : null;
    } catch (error) {
      throw mapManualDatabaseError(error, "read");
    }
  },

  async findBySha256(motorcycleId, sha256) {
    try {
      const validatedSha256 = validateManualSha256(sha256);
      const result = await getPool().query<ManualDocumentRow>(
        `select id, motorcycle_id, file_name, content_type, storage_key,
                file_size_bytes, sha256, page_count, status, extraction_method,
                error_message, uploaded_at, processed_at
           from public.manual_documents
          where motorcycle_id = $1 and sha256 = $2
          limit 1`,
        [motorcycleId, validatedSha256],
      );

      return result.rows[0] ? mapManualDocument(result.rows[0]) : null;
    } catch (error) {
      throw mapManualDatabaseError(error, "read");
    }
  },

  async createDocument(input) {
    try {
      const metadata = validateManualMetadata(input);
      const storageKey = validateManualStorageKey(input.storageKey);
      const result = await getPool().query<ManualDocumentRow>(
        `insert into public.manual_documents (
           id, motorcycle_id, file_name, content_type, storage_key,
           file_size_bytes, sha256, page_count, status, extraction_method
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded', 'ocr')
         returning id, motorcycle_id, file_name, content_type, storage_key,
                   file_size_bytes, sha256, page_count, status,
                   extraction_method, error_message, uploaded_at, processed_at`,
        [
          input.id,
          input.motorcycleId,
          metadata.fileName,
          metadata.contentType,
          storageKey,
          metadata.fileSizeBytes,
          metadata.sha256,
          metadata.pageCount,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new AppError(
          "UPDATE_FAILED",
          "The manual document was not returned after saving.",
        );
      }

      return mapManualDocument(row);
    } catch (error) {
      throw mapManualDatabaseError(error, "write");
    }
  },

  async deleteDocument(documentId) {
    try {
      await getPool().query(
        "delete from public.manual_documents where id = $1",
        [documentId],
      );
    } catch (error) {
      throw mapManualDatabaseError(error, "write");
    }
  },

  async beginProcessing(documentId) {
    try {
      const result = await getPool().query<ManualDocumentRow>(
        `update public.manual_documents
            set status = 'processing', error_message = null, processed_at = null
          where id = $1 and status in ('uploaded', 'failed', 'ready')
          returning id, motorcycle_id, file_name, content_type, storage_key,
                    file_size_bytes, sha256, page_count, status,
                    extraction_method, error_message, uploaded_at, processed_at`,
        [documentId],
      );

      if (result.rows[0]) {
        return mapManualDocument(result.rows[0]);
      }

      return this.findById(documentId);
    } catch (error) {
      throw mapManualDatabaseError(error, "write");
    }
  },

  async markReady(documentId) {
    try {
      const result = await getPool().query<ManualDocumentRow>(
        `update public.manual_documents
            set status = 'ready', error_message = null, processed_at = now()
          where id = $1 and status = 'processing'
          returning id, motorcycle_id, file_name, content_type, storage_key,
                    file_size_bytes, sha256, page_count, status,
                    extraction_method, error_message, uploaded_at, processed_at`,
        [documentId],
      );

      if (result.rows[0]) {
        return mapManualDocument(result.rows[0]);
      }

      return this.findById(documentId);
    } catch (error) {
      throw mapManualDatabaseError(error, "write");
    }
  },

  async markFailed(documentId, errorMessage) {
    try {
      const result = await getPool().query<ManualDocumentRow>(
        `update public.manual_documents
            set status = 'failed', error_message = $2, processed_at = null
          where id = $1 and status = 'processing'
          returning id, motorcycle_id, file_name, content_type, storage_key,
                    file_size_bytes, sha256, page_count, status,
                    extraction_method, error_message, uploaded_at, processed_at`,
        [documentId, errorMessage.slice(0, 2000)],
      );

      if (result.rows[0]) {
        return mapManualDocument(result.rows[0]);
      }

      return this.findById(documentId);
    } catch (error) {
      throw mapManualDatabaseError(error, "write");
    }
  },

  async listPages(manualId) {
    try {
      const result = await getPool().query<ManualPageRow>(
        `select id, manual_id, page_number, printed_page_label,
                extracted_text, extraction_status, error_message,
                ocr_engine, processed_at
           from public.manual_pages
          where manual_id = $1
          order by page_number asc`,
        [manualId],
      );

      return result.rows.map(mapManualPage);
    } catch (error) {
      throw mapManualDatabaseError(error, "read");
    }
  },

  async savePageWithChunks(manualId, page, chunks) {
    let client: PoolClient | undefined;

    try {
      const database = getPool();
      client = await database.connect();
      await client.query("begin");

      const pageResult = await client.query<ManualPageRow>(
        `insert into public.manual_pages (
           manual_id, page_number, printed_page_label, extracted_text,
           extraction_status, error_message, ocr_engine, processed_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, now())
         on conflict (manual_id, page_number) do update set
           printed_page_label = excluded.printed_page_label,
           extracted_text = excluded.extracted_text,
           extraction_status = excluded.extraction_status,
           error_message = excluded.error_message,
           ocr_engine = excluded.ocr_engine,
           processed_at = excluded.processed_at
         returning id, manual_id, page_number, printed_page_label,
                   extracted_text, extraction_status, error_message,
                   ocr_engine, processed_at`,
        [
          manualId,
          page.pageNumber,
          page.printedPageLabel,
          page.extractedText,
          page.extractionStatus,
          page.errorMessage,
          page.ocrEngine,
        ],
      );

      const pageRow = pageResult.rows[0];
      if (!pageRow) {
        throw new AppError(
          "UPDATE_FAILED",
          "The manual page was not returned after saving.",
        );
      }

      await client.query(
        `delete from public.manual_chunks
          where manual_id = $1 and page_start = $2`,
        [manualId, page.pageNumber],
      );

      for (const chunk of chunks) {
        await client.query(
          `insert into public.manual_chunks (
             manual_id, page_start, page_end, printed_page_start,
             printed_page_end, section_label, content, processor_version
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (manual_id, page_start, page_end, content) do nothing`,
          [
            manualId,
            chunk.pageStart,
            chunk.pageEnd,
            chunk.printedPageStart,
            chunk.printedPageEnd,
            chunk.sectionLabel,
            chunk.content,
            chunk.processorVersion,
          ],
        );
      }

      await client.query("commit");
      return mapManualPage(pageRow);
    } catch (error) {
      if (client) {
        await client.query("rollback").catch(() => undefined);
      }
      throw mapManualDatabaseError(error, "write", {
        operation: "save_page_with_chunks",
        manualId,
        pageNumber: page.pageNumber,
        chunkCount: chunks.length,
      });
    } finally {
      client?.release();
    }
  },

  async getIngestionProgress(manualId) {
    try {
      const database = getPool();
      const [progressResult, failuresResult] = await Promise.all([
        database.query<ManualProgressRow>(
        `select d.page_count as total_pages,
                count(p.id) as accounted_pages,
                count(p.id) filter (
                  where p.extraction_status = 'available'
                    and btrim(coalesce(p.extracted_text, '')) <> ''
                )
                  as available_pages,
                count(p.id) filter (where p.extraction_status = 'failed')
                  as failed_pages
           from public.manual_documents d
           left join public.manual_pages p on p.manual_id = d.id
          where d.id = $1
          group by d.page_count`,
        [manualId],
        ),
        database.query<ManualPageFailureRow>(
          `select page_number, error_message
             from public.manual_pages
            where manual_id = $1
              and extraction_status = 'failed'
            order by page_number asc`,
          [manualId],
        ),
      ]);

      const row = progressResult.rows[0];
      if (!row) {
        throw new AppError(
          "MANUAL_NOT_FOUND",
          "The manual was not found for progress reporting.",
          404,
        );
      }

      return mapManualProgress(
        row,
        failuresResult.rows.map((failure) => ({
          pageNumber: failure.page_number,
          errorMessage: failure.error_message,
        })),
      );
    } catch (error) {
      throw mapManualDatabaseError(error, "read");
    }
  },

  async searchChunks(manualId, query, limit) {
    try {
      const result = await getPool().query<ManualChunkRow>(
        `select id, manual_id, page_start, page_end, printed_page_start,
                printed_page_end, section_label, content, processor_version,
                ts_rank_cd(search_vector, plainto_tsquery('simple', $2)) as rank
           from public.manual_chunks
          where manual_id = $1
            and search_vector @@ plainto_tsquery('simple', $2)
          order by rank desc, page_start asc, id asc
          limit $3`,
        [manualId, query, limit],
      );

      return result.rows.map(mapManualChunk);
    } catch (error) {
      throw mapManualDatabaseError(error, "read");
    }
  },

  async listMaintenanceFacts(manualId) {
    try {
      const result = await getPool().query<MaintenanceRow>(
        `select ${maintenanceFactColumns()}
           from public.maintenance_definitions
          where source_manual_id = $1
            and status = 'active'
          order by source_page_start asc, name asc`,
        [manualId],
      );

      return result.rows.map(mapMaintenanceFact);
    } catch (error) {
      throw mapManualDatabaseError(error, "read");
    }
  },

  async upsertManualMaintenanceFacts(motorcycleId, manualId, facts) {
    let client: PoolClient | undefined;

    try {
      client = await getPool().connect();
      await client.query("begin");

      await client.query(
        `delete from public.maintenance_definitions
          where motorcycle_id = $1
            and source_manual_id = $2
            and origin = 'ocr'`,
        [motorcycleId, manualId],
      );

      for (const fact of facts) {
        const normalized = normalizeMaintenanceFactCorrection(fact);
        await client.query(
          `insert into public.maintenance_definitions (
             motorcycle_id, name, interval_value, interval_unit,
             interval_miles, due_window_miles, status, source, notes,
             source_manual_id, source_page_start, source_page_end,
             source_printed_page_label, source_ocr_context, origin
           )
           values ($1, $2, $3, $4, $5, $5, 'active', 'manual_ocr', $6,
                   $7, $8, $9, $10, $11, 'ocr')
           on conflict (motorcycle_id, name) do update set
             interval_value = case
               when public.maintenance_definitions.origin = 'rider_corrected'
               then public.maintenance_definitions.interval_value
               else excluded.interval_value
             end,
             interval_unit = case
               when public.maintenance_definitions.origin = 'rider_corrected'
               then public.maintenance_definitions.interval_unit
               else excluded.interval_unit
             end,
             interval_miles = case
               when public.maintenance_definitions.origin = 'rider_corrected'
               then public.maintenance_definitions.interval_miles
               else excluded.interval_miles
             end,
             due_window_miles = case
               when public.maintenance_definitions.origin = 'rider_corrected'
               then public.maintenance_definitions.due_window_miles
               else excluded.due_window_miles
             end,
             source = 'manual_ocr',
             notes = case
               when public.maintenance_definitions.origin = 'rider_corrected'
               then public.maintenance_definitions.notes
               else excluded.notes
             end,
             source_manual_id = excluded.source_manual_id,
             source_page_start = excluded.source_page_start,
             source_page_end = excluded.source_page_end,
             source_printed_page_label = excluded.source_printed_page_label,
             source_ocr_context = excluded.source_ocr_context,
             origin = case
               when public.maintenance_definitions.origin = 'rider_corrected'
               then public.maintenance_definitions.origin
               else 'ocr'
             end,
             corrected_at = public.maintenance_definitions.corrected_at`,
          [
            motorcycleId,
            normalized.name,
            normalized.intervalValue,
            normalized.intervalUnit,
            normalized.intervalMiles,
            normalized.notes,
            manualId,
            fact.sourcePageStart,
            fact.sourcePageEnd,
            fact.sourcePrintedPageLabel,
            fact.rawOcrContext,
          ],
        );
      }

      await client.query(
        "select public.disable_provisional_maintenance_if_manual_fact_exists($1, $2)",
        [motorcycleId, manualId],
      );
      await client.query("commit");
    } catch (error) {
      await client?.query("rollback").catch(() => undefined);
      throw mapManualDatabaseError(error, "write");
    } finally {
      client?.release();
    }

    return this.listMaintenanceFacts(manualId);
  },

  async correctMaintenanceFact(motorcycleId, manualId, factId, input) {
    let client: PoolClient | undefined;

    try {
      client = await getPool().connect();
      await client.query("begin");

      const currentResult = await client.query<MaintenanceRow>(
        `select ${maintenanceFactColumns()}
           from public.maintenance_definitions
          where id = $1
            and motorcycle_id = $2
            and source_manual_id = $3
            and status = 'active'
          for update`,
        [factId, motorcycleId, manualId],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new AppError(
          "MANUAL_NOT_FOUND",
          "The manual maintenance fact was not found.",
          404,
        );
      }

      const normalized = normalizeMaintenanceFactCorrection({
        name: input.name ?? current.name,
        intervalValue: input.intervalValue ?? parsePositiveNumber(current.interval_value),
        intervalUnit: input.intervalUnit ?? current.interval_unit,
        notes: input.notes === undefined ? current.notes : input.notes,
      });

      const updatedResult = await client.query<MaintenanceRow>(
        `update public.maintenance_definitions
            set name = $4,
                interval_value = $5,
                interval_unit = $6,
                interval_miles = $7,
                due_window_miles = $7,
                notes = $8,
                origin = 'rider_corrected',
                corrected_at = now()
          where id = $1
            and motorcycle_id = $2
            and source_manual_id = $3
          returning ${maintenanceFactColumns()}`,
        [
          factId,
          motorcycleId,
          manualId,
          normalized.name,
          normalized.intervalValue,
          normalized.intervalUnit,
          normalized.intervalMiles,
          normalized.notes,
        ],
      );
      const updated = updatedResult.rows[0];
      if (!updated) {
        throw new AppError(
          "UPDATE_FAILED",
          "The maintenance fact was not returned after correction.",
        );
      }

      await client.query("commit");
      return mapMaintenanceFact(updated);
    } catch (error) {
      await client?.query("rollback").catch(() => undefined);
      throw mapManualDatabaseError(error, "write");
    } finally {
      client?.release();
    }
  },
};

export const manualRepository = postgresManualRepository;
