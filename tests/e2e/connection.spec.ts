import { expect, test } from "@playwright/test";

test("shows an honest unavailable state when the database is not configured", async ({
  page,
}) => {
  test.skip(Boolean(process.env.DATABASE_URL), "Requires an unconfigured local database.");

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Motorcycle state is not connected" }),
  ).toBeVisible();
  await expect(page.getByText(/database|DATABASE_URL/i)).toBeVisible();
});

test("renders the connected motorcycle workflow when a database is configured", async ({
  page,
}) => {
  test.skip(!process.env.DATABASE_URL, "Requires the private Supabase database.");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /1981 Suzuki GS750/ })).toBeVisible();
  await expect(page.locator("#current-mileage-heading")).toHaveText(
    /^\d[\d,]*(?:\.\d+)?$/,
  );
  await expect(page.locator("#maintenance-overview")).toBeVisible();
});

test("manual route loads an honest workspace without exposing storage URLs", async ({
  page,
}) => {
  await page.goto("/manual");

  await expect(
    page.getByRole("heading", { name: "GS750 service manual" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".manual-state-card, .manual-status-card")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("body")).not.toContainText("supabase.co");
  await expect(page.locator("body")).not.toContainText("storageKey");

  if (await page.locator(".manual-state-card").count()) {
    await expect(page.locator("iframe")).toHaveCount(0);
  }
});

test("manual facts remain source-linked through the correction surface", async ({ page }) => {
  test.skip(
    process.env.MOTOMEMORY_PHASE7_E2E !== "1",
    "Requires a configured ready manual and an explicit Phase 7 acceptance run.",
  );

  await page.goto("/manual");
  await expect(page.getByRole("heading", { name: "Manual-derived intervals" })).toBeVisible();
  const fact = page.locator(".manual-fact").first();
  await expect(fact.getByText("Open source", { exact: false })).toBeVisible();
  await expect(fact.getByText("Raw OCR context", { exact: false })).toBeVisible();

  await fact.getByRole("button", { name: "Correct fact" }).click();
  await fact.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Fact corrected.", { exact: false })).toBeVisible();
  await expect(fact.getByText("Rider corrected", { exact: false })).toBeVisible();
});
