import { describe, expect, it } from "vitest";

import { manualQuestionEvaluation } from "@/tests/fixtures/manual-question-evaluation";

describe("manual question evaluation fixture", () => {
  it("contains eight evidence questions and two unsupported questions", () => {
    expect(manualQuestionEvaluation).toHaveLength(10);
    expect(manualQuestionEvaluation.filter((item) => item.expectedToHaveEvidence)).toHaveLength(8);
    expect(manualQuestionEvaluation.filter((item) => !item.expectedToHaveEvidence)).toHaveLength(2);
  });
});
