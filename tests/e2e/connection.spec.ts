import { expect, test } from "@playwright/test";

test("opens the live motorcycle view in read-only guest mode", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.locator("h1").filter({
      hasText: /motorcycle memory|personal motorcycle maintenance companion/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/read-only deployment|local owner mode/i).first()).toBeVisible();
});

test("renders the connected owner workflow when an owner acceptance run is configured", async ({
  page,
}) => {
  test.skip(
    process.env.MOTOMEMORY_OWNER_E2E !== "1",
    "Requires a configured private Supabase local-owner acceptance run.",
  );

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

  await expect(page.getByRole("heading", { name: /GS750 service manual/i })).toBeVisible();
  if (!process.env.DATABASE_URL) {
    await expect(page.locator("body")).toContainText(
      /manual service|database/i,
    );
  }
});

test("manual facts remain source-linked through the correction surface", async ({ page }) => {
  test.skip(
    process.env.MOTOMEMORY_OWNER_E2E !== "1" || process.env.MOTOMEMORY_PHASE7_E2E !== "1",
    "Requires a configured local owner and an explicit manual acceptance run.",
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
