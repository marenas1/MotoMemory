import { expect, test } from "@playwright/test";

test("shows an honest unavailable state when the database is not configured", async ({
  page,
}) => {
  test.skip(Boolean(process.env.DATABASE_URL), "Requires an unconfigured local database.");

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Motorcycle state is not connected" }),
  ).toBeVisible();
  await expect(page.getByText("DATABASE_URL")).toBeVisible();
});

test("renders the connected motorcycle workflow when a database is configured", async ({
  page,
}) => {
  test.skip(!process.env.DATABASE_URL, "Requires the private Supabase database.");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /1981 Suzuki GS750/ })).toBeVisible();
  await expect(page.getByText("18,501")).toBeVisible();
  await expect(page.getByText("19,000 mi")).toBeVisible();
  await expect(page.getByText("499 mi")).toBeVisible();
});
