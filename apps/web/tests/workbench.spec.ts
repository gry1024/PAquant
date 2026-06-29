import { expect, test } from "@playwright/test";

test("renders the desktop trading workstation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /PAquant XAU workstation/i })).toBeVisible();
  await expect(page.getByLabel("AI trader analysis").getByText("Brooks Generalist")).toBeVisible();
  await expect(page.getByTestId("chart-host")).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.screenshot({ path: "test-results/workbench.png", fullPage: true });
});
