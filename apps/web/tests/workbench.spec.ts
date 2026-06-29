import { expect, test } from "@playwright/test";

test("renders the desktop trading workstation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /PAquant XAU workstation/i })).toBeVisible();
  await expect(page.getByLabel("AI trader analysis").getByText("AI trader idle")).toBeVisible();
  await expect(page.getByText("Bar 24/72")).toBeVisible();
  await expect(page.getByLabel("Model API")).toHaveValue("mock");
  await expect(page.getByText("Last price")).toBeVisible();

  await page.getByRole("button", { name: /Start data stream/i }).click();
  await expect(page.getByText("Bar 25/72")).toBeVisible();

  await page.getByRole("button", { name: /Start AI trader/i }).click();
  await expect(page.getByLabel("AI trader analysis").getByText("Brooks Generalist")).toBeVisible();
  await expect(page.getByText("Tool actions")).toBeVisible();
  await expect(page.getByText(/Model API: mock/i)).toBeVisible();
  await expect(page.getByText(/Entry 2310.00/i)).toBeVisible();
  await expect(page.getByText(/Stop 2305.00/i)).toBeVisible();
  await expect(page.getByText(/Target 2320.00/i)).toBeVisible();
  await expect(page.getByText(/Position size 1/i)).toBeVisible();
  await page.getByRole("button", { name: /Reset replay/i }).click();
  await expect(page.getByText("Bar 9/72")).toBeVisible();
  await expect(page.getByTestId("chart-host")).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.screenshot({ path: "test-results/workbench.png", fullPage: true });
});
