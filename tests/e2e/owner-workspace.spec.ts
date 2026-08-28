import { expect, test } from "@playwright/test";

function ownerAcceptanceConfigured(): boolean {
  return process.env.MOTOMEMORY_OWNER_E2E === "1";
}

test("local owner reaches the live editing workspace without sign-in", async ({ page }) => {
  test.skip(!ownerAcceptanceConfigured(), "Requires a configured local owner and isolated acceptance database.");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /1981 Suzuki GS750/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manual" })).toHaveAttribute("href", "/manual");
  await expect(page.getByText("Local owner mode")).toBeVisible();
});
