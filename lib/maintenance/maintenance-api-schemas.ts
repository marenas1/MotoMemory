import { z } from "zod";

const maintenanceRecordSchema = z.object({
  id: z.string(),
  motorcycleId: z.string(),
  definitionId: z.string().nullable(),
  serviceType: z.string(),
  performedMileage: z.number(),
  performedAt: z.string().nullable(),
  notes: z.string().nullable(),
  parts: z.array(z.string()).nullable(),
  cost: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const maintenanceDefinitionSchema = z.object({
  id: z.string(),
  motorcycleId: z.string(),
  name: z.string(),
  intervalValue: z.number().optional(),
  intervalUnit: z.enum(["mi", "km"]).optional(),
  intervalMiles: z.number(),
  dueWindowMiles: z.number(),
  status: z.literal("active"),
  source: z.string(),
  notes: z.string().nullable(),
  sourceManualId: z.string().nullable().optional(),
  sourcePageStart: z.number().nullable().optional(),
  sourcePageEnd: z.number().nullable().optional(),
  sourcePrintedPageLabel: z.string().nullable().optional(),
  rawOcrContext: z.string().nullable().optional(),
  origin: z.enum(["ocr", "rider_corrected"]).nullable().optional(),
  correctedAt: z.string().nullable().optional(),
  sourceHref: z.string().nullable().optional(),
});

export const maintenanceHistoryResponseSchema = z.object({
  currentMileage: z.number(),
  definitions: z.array(maintenanceDefinitionSchema),
  records: z.array(maintenanceRecordSchema),
});

export const maintenanceRecordResponseSchema = z.object({
  record: maintenanceRecordSchema,
});

export const maintenanceRecordDeleteResponseSchema = z.object({
  deletedId: z.string(),
});

export type MaintenanceHistoryResponse = z.infer<
  typeof maintenanceHistoryResponseSchema
>;
export type MaintenanceRecordResponse = z.infer<
  typeof maintenanceRecordResponseSchema
>;
