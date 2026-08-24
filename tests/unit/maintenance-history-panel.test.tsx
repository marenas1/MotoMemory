import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MaintenanceHistoryForm } from "@/components/maintenance-history-panel";
import { MaintenanceOutlook } from "@/components/maintenance-outlook";

const definitions = [
  {
    id: "223e4567-e89b-12d3-a456-426614174000",
    motorcycleId: "gs750",
    name: "Engine oil",
    intervalValue: 2500,
    intervalUnit: "mi" as const,
    intervalMiles: 2500,
    dueWindowMiles: 250,
    status: "active" as const,
    source: "manual_ocr",
    notes: null,
    sourceManualId: null,
    sourcePageStart: null,
    sourcePageEnd: null,
    sourcePrintedPageLabel: null,
    origin: "ocr" as const,
    correctedAt: null,
    sourceHref: null,
  },
];

describe("maintenance history form", () => {
  it("offers one active item or Other / unlinked and caps mileage at current mileage", () => {
    const markup = renderToStaticMarkup(
      <MaintenanceHistoryForm
        definitions={definitions}
        currentMileage={18501}
        initialValues={{
          definitionId: definitions[0].id,
          serviceType: definitions[0].name,
          performedMileage: "",
          performedAt: "",
          parts: "",
          cost: "",
          notes: "",
        }}
        submitLabel="Save record"
        busy={false}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    expect(markup).toContain("Engine oil");
    expect(markup).toContain("Other / unlinked");
    expect(markup).toContain('max="18501"');
    expect(markup).toContain("one per line");
    expect((markup.match(/<select/g) ?? []).length).toBe(1);
    expect(markup).not.toContain("checkbox");
  });
});

describe("maintenance outlook presentation", () => {
  it("labels missing history without rendering a personalized target", () => {
    const markup = renderToStaticMarkup(
      <MaintenanceOutlook
        items={[
          {
            definitionId: definitions[0].id,
            name: definitions[0].name,
            currentMileage: 18_501,
            intervalValue: 2500,
            intervalUnit: "mi",
            intervalMiles: 2500,
            lastServiceRecordId: null,
            lastServiceMileage: null,
            dueMileage: null,
            remainingMiles: null,
            status: "not_recorded",
            source: "manual_ocr",
            sourceManualId: null,
            sourcePageStart: null,
            sourcePageEnd: null,
            sourcePrintedPageLabel: null,
            sourceHref: null,
          },
        ]}
      />,
    );

    expect(markup).toContain("Not recorded");
    expect(markup).toContain("Record the completed service");
    expect(markup).not.toContain("Next target");
  });

  it("shows every calculation input, result, evidence, and correction link", () => {
    const markup = renderToStaticMarkup(
      <MaintenanceOutlook
        items={[
          {
            definitionId: definitions[0].id,
            name: definitions[0].name,
            currentMileage: 18_501,
            intervalValue: 2500,
            intervalUnit: "mi",
            intervalMiles: 2500,
            lastServiceRecordId: "123e4567-e89b-12d3-a456-426614174000",
            lastServiceMileage: 16_000,
            dueMileage: 18_500,
            remainingMiles: -1,
            status: "overdue",
            source: "manual_ocr",
            sourceManualId: "manual-1",
            sourcePageStart: 42,
            sourcePageEnd: 42,
            sourcePrintedPageLabel: "38",
            rawOcrContext: "Change engine oil every 2,500 miles.",
            sourceHref: "/manual?page=42&printedPage=38",
          },
        ]}
      />,
    );

    expect(markup).toContain("Overdue");
    expect(markup).toContain("18,501 mi");
    expect(markup).toContain("2,500 mi");
    expect(markup).toContain("16,000 mi");
    expect(markup).toContain("18,500 mi");
    expect(markup).toContain("-1 mi");
    expect(markup).toContain('href="#maintenance-record-123e4567-e89b-12d3-a456-426614174000"');
    expect(markup).toContain('href="/manual?page=42&amp;printedPage=38"');
    expect(markup).toContain("Change engine oil every 2,500 miles.");
  });
});
