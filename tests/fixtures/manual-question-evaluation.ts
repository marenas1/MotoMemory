export interface ManualQuestionEvaluationCase {
  id: string;
  question: string;
  expectedToHaveEvidence: boolean;
  evidenceTerms: string[];
}

/**
 * The fixture is intentionally independent of page numbers. After the real
 * manual is OCR'd, the recorded retrieval result for each case can be filled
 * with the observed page and rank without changing the route contract.
 */
export const manualQuestionEvaluation: ManualQuestionEvaluationCase[] = [
  {
    id: "oil-change-interval",
    question: "What oil change interval does the manual specify?",
    expectedToHaveEvidence: true,
    evidenceTerms: ["oil", "change", "interval"],
  },
  {
    id: "valve-clearance",
    question: "What valve clearance should I use?",
    expectedToHaveEvidence: true,
    evidenceTerms: ["valve", "clearance"],
  },
  {
    id: "spark-plug",
    question: "Which spark plug specification does the manual list?",
    expectedToHaveEvidence: true,
    evidenceTerms: ["spark", "plug"],
  },
  {
    id: "chain-adjustment",
    question: "How does the manual describe drive-chain adjustment?",
    expectedToHaveEvidence: true,
    evidenceTerms: ["chain", "adjustment"],
  },
  {
    id: "brake-fluid",
    question: "What brake-fluid maintenance instruction is in the manual?",
    expectedToHaveEvidence: true,
    evidenceTerms: ["brake", "fluid"],
  },
  {
    id: "air-filter",
    question: "When does the manual say to inspect or replace the air filter?",
    expectedToHaveEvidence: true,
    evidenceTerms: ["air", "filter"],
  },
  {
    id: "coolant",
    question: "What coolant capacity does the manual specify?",
    expectedToHaveEvidence: true,
    evidenceTerms: ["coolant", "capacity"],
  },
  {
    id: "battery",
    question: "What battery charging instruction does the manual provide?",
    expectedToHaveEvidence: true,
    evidenceTerms: ["battery", "charging"],
  },
  {
    id: "tire-brand",
    question: "Which tire brand should I buy according to the manual?",
    expectedToHaveEvidence: false,
    evidenceTerms: ["tire", "brand"],
  },
  {
    id: "winter-storage-location",
    question: "Which garage should I use for winter storage?",
    expectedToHaveEvidence: false,
    evidenceTerms: ["winter", "storage", "garage"],
  },
];
