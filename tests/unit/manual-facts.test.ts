import { describe, expect, it } from "vitest";

import {
  extractManualMaintenanceFacts,
  intervalToMiles,
  normalizeMaintenanceFactCorrection,
} from "@/lib/manual/manual-facts";
import type { ManualPageRecord } from "@/lib/manual/manual-types";

function page(text: string): ManualPageRecord {
  return {
    id: "page-12",
    manualId: "manual-1",
    pageNumber: 12,
    printedPageLabel: "9",
    extractedText: text,
    extractionStatus: "available",
    errorMessage: null,
    ocrEngine: "fake-ocr",
    processedAt: new Date(0).toISOString(),
  };
}

describe("manual maintenance fact extraction", () => {
  it("extracts explicit task and interval pairs with both page labels and raw OCR context", () => {
    const facts = extractManualMaintenanceFacts(
      "manual-1",
      "gs750",
      [
        page(
          "MAINTENANCE SCHEDULE\nOil change every 2,000 miles\nInspect valve clearance every 4,000 km",
        ),
      ],
    );

    expect(facts).toEqual([
      expect.objectContaining({
        name: "Oil change",
        intervalValue: 2000,
        intervalUnit: "mi",
        intervalMiles: 2000,
        sourceManualId: "manual-1",
        sourcePageStart: 12,
        sourcePageEnd: 12,
        sourcePrintedPageLabel: "9",
      }),
      expect.objectContaining({
        name: "Inspect valve clearance",
        intervalValue: 4000,
        intervalUnit: "km",
        intervalMiles: expect.any(Number),
        rawOcrContext: expect.any(String),
      }),
    ]);
    expect(facts[1]?.intervalMiles).toBeCloseTo(2485.484768, 4);
    expect(facts[1]?.rawOcrContext).toContain("Oil change every 2,000 miles");
  });

  it("does not promote an isolated mileage number into a maintenance fact", () => {
    expect(
      extractManualMaintenanceFacts("manual-1", "gs750", [
        page("Specifications\nMaximum speed 120 miles per hour"),
      ]),
    ).toEqual([]);
  });

  it("prefers mile intervals and avoids promoting table OCR noise", () => {
    const facts = extractManualMaintenanceFacts(
      "manual-1",
      "gs750",
      [
        page(
          "Air cleaner element Clean every 2,000 miles (3,000 km), and replace every 7,500 miles (12,000 km).",
        ),
        page(
          "Battery (Specific gravity) = | | | tivelna har slernant Clean every 2,000 miles (3,000 km).",
        ),
      ],
    );

    expect(facts.map(({ name, intervalValue, intervalUnit }) => ({ name, intervalValue, intervalUnit }))).toEqual([
      { name: "Air cleaner element Clean", intervalValue: 2000, intervalUnit: "mi" },
      { name: "Air cleaner element replace", intervalValue: 7500, intervalUnit: "mi" },
    ]);
  });

  it("recovers task and interval pairs split across scanned-manual lines", () => {
    const facts = extractManualMaintenanceFacts(
      "manual-1",
      "gs750",
      [
        page(
          "The air cleaner element must be cleaned.\nCheck and clean the air cleaner element every 2,000 miles (3,000 km).\nReplace the air cleaner element with\na new one every 7,500 miles (12,000 km).",
        ),
        page(
          "The spark plugs should be replaced every 7,500 miles (12,000 km).",
        ),
        page(
          "Change the engine oil and oil filter at the\ninitial 600 miles (1,000 km) and also at the\nevery 4,000 miles (6,000 km), The oil",
        ),
        page(
          "At initial GOO miles {1,000 km) and every\n4,000 miles (6,000 km), adjust the clutch",
        ),
        page(
          "At the periodic inspections performed at the initial 600 miles (1,000 km) and every 4,000 miles (6,000 km), the drive chain should be inspected",
        ),
      ],
    );

    expect(facts.map(({ name, intervalValue, intervalUnit }) => ({ name, intervalValue, intervalUnit }))).toEqual([
      { name: "clean air cleaner element", intervalValue: 2000, intervalUnit: "mi" },
      { name: "Replace air cleaner element", intervalValue: 7500, intervalUnit: "mi" },
      { name: "spark plugs replace", intervalValue: 7500, intervalUnit: "mi" },
      { name: "Change engine oil and oil filter", intervalValue: 4000, intervalUnit: "mi" },
      { name: "adjust clutch", intervalValue: 4000, intervalUnit: "mi" },
      { name: "drive chain inspect", intervalValue: 4000, intervalUnit: "mi" },
    ]);
  });

  it("normalizes corrections and converts kilometer intervals for the mileage outlook", () => {
    expect(intervalToMiles(100, "km")).toBeCloseTo(62.1371, 4);
    expect(
      normalizeMaintenanceFactCorrection({
        name: "  Valve check ",
        intervalValue: 5000,
        intervalUnit: "km",
        notes: "  Verify the table on the source page. ",
      }),
    ).toMatchObject({
      name: "Valve check",
      intervalValue: 5000,
      intervalUnit: "km",
      notes: "Verify the table on the source page.",
    });
  });
});
