import { z } from "zod";

const manualIdentitySchema = z
  .object({
    id: z.string().min(1),
    fileName: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    pageCount: z.number().int().positive(),
  })
  .strict();

const manualPassageSchema = z
  .object({
    id: z.string().min(1),
    manualId: z.string().min(1),
    pageStart: z.number().int().positive(),
    pageEnd: z.number().int().positive(),
    printedPageStart: z.string().nullable(),
    printedPageEnd: z.string().nullable(),
    sectionLabel: z.string().nullable(),
    content: z.string().min(1),
    processorVersion: z.string().nullable(),
    rank: z.number().optional(),
    citationHref: z.string().regex(/^\/manual\?page=\d+/),
  })
  .strict();

const manualCitationSchema = z
  .object({
    passageId: z.string().min(1),
    manualId: z.string().min(1),
    pdfPageStart: z.number().int().positive(),
    pdfPageEnd: z.number().int().positive(),
    printedPageStart: z.string().nullable(),
    printedPageEnd: z.string().nullable(),
    href: z.string().regex(/^\/manual\?page=\d+/),
  })
  .strict();

const manualFactSchema = z
  .object({
    id: z.string().min(1),
    motorcycleId: z.string().min(1),
    name: z.string().min(1),
    intervalValue: z.number().positive(),
    intervalUnit: z.enum(["mi", "km"]),
    intervalMiles: z.number().positive(),
    dueWindowMiles: z.number().nonnegative(),
    status: z.literal("active"),
    source: z.string().min(1),
    notes: z.string().nullable(),
    sourceManualId: z.string().min(1),
    sourcePageStart: z.number().int().positive(),
    sourcePageEnd: z.number().int().positive(),
    sourcePrintedPageLabel: z.string().nullable(),
    rawOcrContext: z.string().nullable(),
    origin: z.enum(["ocr", "rider_corrected"]),
    correctedAt: z.string().datetime().nullable(),
    sourceHref: z.string().regex(/^\/manual\?page=\d+/),
  })
  .strict();

export const manualFactCorrectionRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    intervalValue: z.number().finite().positive().max(1_000_000).optional(),
    intervalUnit: z.enum(["mi", "km"]).optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one maintenance fact field must be corrected.",
  });

export const manualFactsResponseSchema = z
  .object({
    manualId: z.string().min(1),
    facts: z.array(manualFactSchema),
  })
  .strict();

export const manualFactCorrectionResponseSchema = z
  .object({
    fact: manualFactSchema,
    maintenanceOutlook: z.array(z.record(z.string(), z.unknown())),
  })
  .strict();

export const manualSearchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();

export const manualQuestionRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(500),
  })
  .strict();

export const manualSearchResponseSchema = z
  .object({
    manualId: z.string().min(1),
    manual: manualIdentitySchema,
    passages: z.array(manualPassageSchema),
  })
  .strict();

const manualAnswerFields = {
  manual: manualIdentitySchema,
  passages: z.array(manualPassageSchema),
};

export const manualQuestionResponseSchema = z.discriminatedUnion("state", [
  z
    .object({
      ...manualAnswerFields,
      state: z.literal("supported_evidence"),
      answer: z.string().min(1),
      citations: z.array(manualCitationSchema).min(1),
    })
    .strict(),
  z
    .object({
      ...manualAnswerFields,
      state: z.literal("insufficient_evidence"),
      answer: z.string().min(1),
      citations: z.array(manualCitationSchema),
    })
    .strict(),
  z
    .object({
      ...manualAnswerFields,
      state: z.literal("provider_unavailable"),
      message: z.string().min(1),
      citations: z.array(manualCitationSchema),
    })
    .strict(),
  z
    .object({
      ...manualAnswerFields,
      state: z.literal("citation_mismatch"),
      message: z.string().min(1),
      citations: z.array(manualCitationSchema),
    })
    .strict(),
]);

export type ManualSearchRequest = z.infer<typeof manualSearchRequestSchema>;
export type ManualQuestionRequest = z.infer<typeof manualQuestionRequestSchema>;
export type ManualSearchResponse = z.infer<typeof manualSearchResponseSchema>;
export type ManualQuestionResponse = z.infer<typeof manualQuestionResponseSchema>;
