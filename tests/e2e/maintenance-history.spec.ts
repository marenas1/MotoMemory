import { expect, test } from "@playwright/test";

type MaintenanceDefinition = {
  id: string;
  name: string;
  intervalMiles: number;
  sourceHref?: string | null;
};

type MaintenanceRecord = {
  id: string;
  definitionId: string | null;
  performedMileage: number;
};

type MaintenanceHistory = {
  currentMileage: number;
  definitions: MaintenanceDefinition[];
  records: MaintenanceRecord[];
};

function roundMileage(value: number): number {
  return Math.round(value * 100) / 100;
}

test("accepts, explains, corrects, rejects, and deletes a linked service record", async ({
  page,
}) => {
  test.skip(
    process.env.MOTOMEMORY_OWNER_E2E !== "1",
    "Requires the configured private owner and a source-linked maintenance definition.",
  );

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /1981 Suzuki GS750/ })).toBeVisible();

  const history = await page.evaluate(async () => {
    const response = await fetch("/api/maintenance/records", { cache: "no-store" });
    if (!response.ok) throw new Error(`Maintenance history request failed: ${response.status}`);
    return (await response.json()) as MaintenanceHistory;
  });
  const definition = history.definitions.find(
    (item) => item.sourceHref && item.intervalMiles > 0,
  );

  test.skip(
    !definition,
    "Requires a configured source-linked maintenance definition with a usable interval.",
  );

  const targetDefinition = definition as MaintenanceDefinition;
  test.skip(
    history.records.some((record) => record.definitionId === targetDefinition.id),
    "Requires a clean source-linked maintenance definition with no existing service record.",
  );

  const serviceMileage = roundMileage(
    history.currentMileage - targetDefinition.intervalMiles,
  );
  test.skip(
    serviceMileage < 0,
    "The selected interval is greater than the current mileage, so a due fixture cannot be created safely.",
  );
  const editedServiceMileage = roundMileage(serviceMileage - 1);
  test.skip(
    editedServiceMileage < 0,
    "The selected service mileage is zero, so an overdue edit cannot be created safely.",
  );

  const outlookCard = page.locator(`#maintenance-outlook-${targetDefinition.id}`);
  await expect(outlookCard.locator(".status-pill")).toHaveText("Not recorded");
  await expect(outlookCard.getByText("Next target", { exact: true })).toHaveCount(0);
  await expect(
    outlookCard.getByRole("link", { name: "Open manual source" }),
  ).toHaveAttribute("href", targetDefinition.sourceHref as string);

  let createdRecord: MaintenanceRecord | null = null;
  try {
    await page.getByLabel("Maintenance item").selectOption(targetDefinition.id);
    await page.getByLabel("Performed mileage").fill(String(serviceMileage));
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/maintenance/records") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save record" }).click();
    createdRecord = (await (await createResponse).json()).record as MaintenanceRecord;
    await expect(page.getByRole("status")).toContainText("Maintenance record saved.");
    await expect(outlookCard.locator(".status-pill")).toHaveText("Due now");
    await expect(
      outlookCard.getByText(`${history.currentMileage.toLocaleString()} mi`, { exact: true }),
    ).toHaveCount(2);
    await expect(
      outlookCard.getByText(`${serviceMileage.toLocaleString()} mi`, { exact: true }),
    ).toBeVisible();
    await expect(
      outlookCard
        .locator("dt")
        .filter({ hasText: "Interval" })
        .locator("xpath=..")
        .locator("dd"),
    ).toContainText("mi");
    await expect(outlookCard.getByRole("link", { name: "View service record" })).toHaveAttribute(
      "href",
      `#maintenance-record-${createdRecord.id}`,
    );

    await page.getByLabel("Performed mileage").fill(String(history.currentMileage + 1));
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(page.locator(".state-feedback-error")).toContainText(
      "Record rejected: Performed mileage cannot exceed the current motorcycle mileage.",
    );

    const recordCard = page.locator(`#maintenance-record-${createdRecord.id}`);
    await recordCard.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Performed mileage").fill(String(editedServiceMileage));
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("Maintenance record updated.");
    await expect(outlookCard.locator(".status-pill")).toHaveText("Overdue");

    page.once("dialog", (dialog) => void dialog.accept());
    await recordCard.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("status")).toContainText("Maintenance record deleted.");
    await expect(outlookCard.locator(".status-pill")).toHaveText("Not recorded");
    await expect(outlookCard.getByText("Next target", { exact: true })).toHaveCount(0);
    await expect(
      outlookCard.getByRole("link", { name: "Open manual source" }),
    ).toHaveAttribute("href", targetDefinition.sourceHref as string);
  } finally {
    if (createdRecord) {
      await page.request.delete(`/api/maintenance/records/${createdRecord.id}`).catch(() => undefined);
    }
  }
});
