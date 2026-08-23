import "server-only";

import {
  manualQuestionRequestSchema,
  type ManualQuestionResponse,
} from "@/lib/manual/manual-api-schemas";
import {
  buildManualCitationHref,
  isPassageWithinManual,
  toManualPassage,
} from "@/lib/manual/manual-citations";
import {
  manualRepository,
  type ManualRepository,
} from "@/lib/data/manual-repository";
import type {
  ManualChunkRecord,
  ManualDocumentRecord,
  ManualIdentity,
} from "@/lib/manual/manual-types";
import { searchManualChunks } from "@/lib/manual/retrieval";
import { AppError } from "@/lib/server/errors";

export const MAX_ANSWER_PASSAGES = 8;
export const MAX_ANSWER_EVIDENCE_CHARACTERS = 12_000;
export const ANSWER_PROVIDER_UNAVAILABLE_MESSAGE =
  "Answer generation is not configured. Manual evidence search and PDF browsing remain available.";

export interface AnswerProviderInput {
  question: string;
  manual: ManualIdentity;
  passages: ManualChunkRecord[];
}

export interface AnswerProviderCitation {
  passageId: string;
  manualId: string;
  pdfPageStart: number;
  pdfPageEnd: number;
  printedPageStart: string | null;
  printedPageEnd: string | null;
}

export interface AnswerProviderResult {
  answer: string;
  citations: AnswerProviderCitation[];
}

export interface AnswerProvider {
  readonly name: string;
  answer(input: AnswerProviderInput): Promise<AnswerProviderResult>;
}

export class AnswerProviderUnavailableError extends Error {
  constructor(message = ANSWER_PROVIDER_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "AnswerProviderUnavailableError";
  }
}

/**
 * The default is deliberately unavailable. No SDK, network call, or model
 * memory is allowed to turn a missing provider into an unsupported answer.
 */
export class UnavailableAnswerProvider implements AnswerProvider {
  readonly name = "unconfigured";

  async answer(): Promise<never> {
    throw new AnswerProviderUnavailableError();
  }
}

export function getConfiguredAnswerProvider(): AnswerProvider {
  const configuredProvider = process.env.MOTOMEMORY_ANSWER_PROVIDER?.trim();

  if (!configuredProvider || configuredProvider.toLowerCase() === "unavailable") {
    return new UnavailableAnswerProvider();
  }

  // Provider selection is intentionally not implemented until the evaluation
  // corpus and credential boundary are agreed. Unknown values fail closed.
  return new UnavailableAnswerProvider();
}

export interface ManualAnswerDependencies {
  repository: Pick<ManualRepository, "searchChunks">;
  provider: AnswerProvider;
}

function boundPassages(passages: ManualChunkRecord[]): ManualChunkRecord[] {
  const bounded: ManualChunkRecord[] = [];
  let characters = 0;

  for (const passage of passages.slice(0, MAX_ANSWER_PASSAGES)) {
    const content = passage.content.slice(
      0,
      Math.min(passage.content.length, 2_000),
    );
    if (!content.trim()) {
      continue;
    }

    if (
      bounded.length > 0 &&
      characters + content.length > MAX_ANSWER_EVIDENCE_CHARACTERS
    ) {
      break;
    }

    bounded.push({ ...passage, content });
    characters += content.length;
  }

  return bounded;
}

function insufficientEvidenceResponse(
  manual: ManualIdentity,
  passages: ManualChunkRecord[],
): ManualQuestionResponse {
  return {
    state: "insufficient_evidence",
    manual,
    passages: passages.map(toManualPassage),
    answer:
      "The indexed manual evidence is insufficient to answer that question. Open the manual or try a more specific question.",
    citations: [],
  };
}

function providerUnavailableResponse(
  manual: ManualIdentity,
  passages: ManualChunkRecord[],
): ManualQuestionResponse {
  return {
    state: "provider_unavailable",
    manual,
    passages: passages.map(toManualPassage),
    message: ANSWER_PROVIDER_UNAVAILABLE_MESSAGE,
    citations: [],
  };
}

function citationMismatchResponse(
  manual: ManualIdentity,
  passages: ManualChunkRecord[],
): ManualQuestionResponse {
  return {
    state: "citation_mismatch",
    manual,
    passages: passages.map(toManualPassage),
    message:
      "The answer provider returned a citation that did not match the retrieved manual passage. The answer was withheld.",
    citations: [],
  };
}

function validateProviderCitations(
  manual: ManualIdentity,
  passages: ManualChunkRecord[],
  citations: AnswerProviderCitation[],
): boolean {
  if (citations.length === 0) {
    return false;
  }

  return citations.every((citation) => {
    const passage = passages.find((candidate) => candidate.id === citation.passageId);
    return Boolean(
      passage &&
        passage.manualId === manual.id &&
        citation.manualId === manual.id &&
        citation.pdfPageStart === passage.pageStart &&
        citation.pdfPageEnd === passage.pageEnd &&
        citation.printedPageStart === passage.printedPageStart &&
        citation.printedPageEnd === passage.printedPageEnd,
    );
  });
}

export async function answerManualQuestion(
  manual: ManualDocumentRecord,
  question: string,
  dependencies: ManualAnswerDependencies = {
    repository: manualRepository,
    provider: getConfiguredAnswerProvider(),
  },
): Promise<ManualQuestionResponse> {
  const parsedQuestion = manualQuestionRequestSchema.safeParse({ question });
  if (!parsedQuestion.success) {
    throw new AppError(
      "INVALID_MANUAL",
      "A non-empty manual question of 500 characters or fewer is required.",
      400,
    );
  }

  const manualIdentity: ManualIdentity = {
    id: manual.id,
    fileName: manual.fileName,
    sha256: manual.sha256,
    pageCount: manual.pageCount,
  };
  const retrievedPassages = await searchManualChunks(
    manual.id,
    parsedQuestion.data.question,
    dependencies,
    MAX_ANSWER_PASSAGES,
  );
  const passages = boundPassages(
    retrievedPassages.filter((passage) =>
      isPassageWithinManual(passage, manual.id, manual.pageCount),
    ),
  );

  if (passages.length === 0) {
    return insufficientEvidenceResponse(manualIdentity, passages);
  }

  let providerResult: AnswerProviderResult;
  try {
    providerResult = await dependencies.provider.answer({
      question: parsedQuestion.data.question,
      manual: manualIdentity,
      passages,
    });
  } catch (error) {
    if (error instanceof AnswerProviderUnavailableError) {
      return providerUnavailableResponse(manualIdentity, passages);
    }

    return providerUnavailableResponse(manualIdentity, passages);
  }

  const answer = typeof providerResult?.answer === "string"
    ? providerResult.answer.trim()
    : "";
  const citations = Array.isArray(providerResult?.citations)
    ? providerResult.citations
    : [];

  if (!answer || !validateProviderCitations(manualIdentity, passages, citations)) {
    return citationMismatchResponse(manualIdentity, passages);
  }

  return {
    state: "supported_evidence",
    manual: manualIdentity,
    passages: passages.map(toManualPassage),
    answer,
    citations: citations.map((citation) => ({
      passageId: citation.passageId,
      manualId: citation.manualId,
      pdfPageStart: citation.pdfPageStart,
      pdfPageEnd: citation.pdfPageEnd,
      printedPageStart: citation.printedPageStart,
      printedPageEnd: citation.printedPageEnd,
      href: buildManualCitationHref(
        citation.pdfPageStart,
        citation.printedPageStart,
      ),
    })),
  };
}
