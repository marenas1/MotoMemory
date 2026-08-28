import { describe, expect, it, vi } from "vitest";

import {
  answerManualQuestion,
  AnswerProviderUnavailableError,
  getConfiguredAnswerProvider,
  MAX_ANSWER_EVIDENCE_CHARACTERS,
  MAX_ANSWER_PASSAGES,
  type AnswerProvider,
} from "@/lib/manual/manual-answering";
import type {
  ManualChunkRecord,
  ManualDocumentRecord,
} from "@/lib/manual/manual-types";
import { MockAnswerProvider } from "@/tests/fixtures/mock-answer-provider";
import { TEST_SCOPE } from "@/tests/fixtures/test-scope";

const manual: ManualDocumentRecord = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  motorcycleId: "gs750",
  fileName: "gs750-manual.pdf",
  contentType: "application/pdf",
  storageKey: "manuals/gs750/123e4567-e89b-12d3-a456-426614174000.pdf",
  fileSizeBytes: 3_700_000,
  sha256: "a".repeat(64),
  pageCount: 67,
  status: "ready",
  extractionMethod: "ocr",
  errorMessage: null,
  uploadedAt: new Date(0).toISOString(),
  processedAt: new Date(0).toISOString(),
};

const passage: ManualChunkRecord = {
  id: "chunk-1",
  manualId: manual.id,
  pageStart: 34,
  pageEnd: 34,
  printedPageStart: "31",
  printedPageEnd: "31",
  sectionLabel: "Maintenance",
  content: "Replace the engine oil every 2,000 miles.",
  processorVersion: "fake-ocr:v1",
  rank: 0.8,
};

function dependencies(
  provider: AnswerProvider,
  passages: ManualChunkRecord[] = [passage],
) {
  return {
    repository: {
      searchChunks: vi.fn(async (_scope, _manualId: string, _query: string, limit: number) => {
        expect(limit).toBe(MAX_ANSWER_PASSAGES);
        return passages;
      }),
    },
    provider,
  };
}

describe("manual answer boundary", () => {
  it("fails closed for an unimplemented provider configuration", () => {
    const originalProvider = process.env.MOTOMEMORY_ANSWER_PROVIDER;
    process.env.MOTOMEMORY_ANSWER_PROVIDER = "unselected-provider";

    expect(getConfiguredAnswerProvider().name).toBe("unconfigured");

    if (originalProvider === undefined) {
      delete process.env.MOTOMEMORY_ANSWER_PROVIDER;
    } else {
      process.env.MOTOMEMORY_ANSWER_PROVIDER = originalProvider;
    }
  });

  it("returns supported evidence with authoritative page citations", async () => {
    const provider = new MockAnswerProvider((input) => ({
      answer: "The manual specifies an oil change every 2,000 miles.",
      citations: [{
        passageId: input.passages[0]?.id ?? "",
        manualId: input.manual.id,
        pdfPageStart: input.passages[0]?.pageStart ?? 0,
        pdfPageEnd: input.passages[0]?.pageEnd ?? 0,
        printedPageStart: input.passages[0]?.printedPageStart ?? null,
        printedPageEnd: input.passages[0]?.printedPageEnd ?? null,
      }],
    }));

    const result = await answerManualQuestion(
      TEST_SCOPE,
      manual,
      "What is the oil interval?",
      dependencies(provider),
    );

    expect(result).toMatchObject({
      state: "supported_evidence",
      manual: { id: manual.id, fileName: manual.fileName },
      citations: [{
        passageId: passage.id,
        pdfPageStart: 34,
        printedPageStart: "31",
        href: "/manual?page=34&printedPage=31",
      }],
    });
    expect(provider.inputs[0]?.passages).toEqual([passage]);
  });

  it("does not call the provider when retrieval returns no evidence", async () => {
    const provider: AnswerProvider = {
      name: "must-not-run",
      answer: vi.fn(),
    };

    const result = await answerManualQuestion(
      TEST_SCOPE,
      manual,
      "Which garage should I use for winter storage?",
      dependencies(provider, []),
    );

    expect(result.state).toBe("insufficient_evidence");
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it("does not treat a passage belonging to another manual as evidence", async () => {
    const provider: AnswerProvider = {
      name: "must-not-run",
      answer: vi.fn(),
    };

    const result = await answerManualQuestion(
      TEST_SCOPE,
      manual,
      "What is the oil interval?",
      dependencies(provider, [{ ...passage, manualId: "another-manual" }]),
    );

    expect(result.state).toBe("insufficient_evidence");
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it("returns a distinct citation mismatch state and withholds the answer", async () => {
    const provider: AnswerProvider = {
      name: "bad-mock",
      answer: async () => ({
        answer: "The manual says page 99.",
        citations: [{
          passageId: passage.id,
          manualId: manual.id,
          pdfPageStart: 99,
          pdfPageEnd: 99,
          printedPageStart: "96",
          printedPageEnd: "96",
        }],
      }),
    };

    await expect(
      answerManualQuestion(TEST_SCOPE, manual, "Where is the interval?", dependencies(provider)),
    ).resolves.toMatchObject({
      state: "citation_mismatch",
      citations: [],
    });
  });

  it("converts provider outages into a safe state while retaining evidence", async () => {
    const provider: AnswerProvider = {
      name: "offline-mock",
      answer: async () => {
        throw new AnswerProviderUnavailableError();
      },
    };

    const result = await answerManualQuestion(
      TEST_SCOPE,
      manual,
      "What is the oil interval?",
      dependencies(provider),
    );

    expect(result).toMatchObject({
      state: "provider_unavailable",
      passages: [{ id: passage.id, pageStart: 34, printedPageStart: "31" }],
      citations: [],
    });
  });

  it("bounds provider evidence by passage count and total characters", async () => {
    const manyPassages = Array.from({ length: 20 }, (_, index) => ({
      ...passage,
      id: `chunk-${index}`,
      pageStart: index + 1,
      pageEnd: index + 1,
      content: "x".repeat(2_000),
    }));
    let receivedPassages: ManualChunkRecord[] = [];
    const provider: AnswerProvider = {
      name: "bounded-mock",
      answer: async (input) => {
        receivedPassages = input.passages;
        throw new AnswerProviderUnavailableError();
      },
    };

    await answerManualQuestion(
      TEST_SCOPE,
      manual,
      "Find maintenance information",
      dependencies(provider, manyPassages),
    );

    expect(receivedPassages.length).toBeLessThanOrEqual(MAX_ANSWER_PASSAGES);
    expect(receivedPassages.reduce((total, item) => total + item.content.length, 0)).toBeLessThanOrEqual(
      MAX_ANSWER_EVIDENCE_CHARACTERS,
    );
  });
});
