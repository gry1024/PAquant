import { expect, test } from "@playwright/test";

test("renders the live desktop trading workstation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /PAquant XAU workstation/i })).toBeVisible();
  await expect(page.getByText("Live market API")).toBeVisible();
  await expect(page.getByText(/live feed/i)).toBeVisible();
  await expect(page.getByLabel("AI trader analysis").getByText("AI trader idle")).toBeVisible();
  await expect(page.getByText("Last price")).toBeVisible();
  await expect(page.getByLabel("Model API")).not.toHaveValue("mock");
  await expect(page.getByTestId("chart-host")).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();

  const initialCounter = await page.locator(".replay-counter").innerText();
  await page.getByRole("button", { name: /Start data stream/i }).click();
  await expect(page.locator(".replay-counter")).not.toHaveText(initialCounter);

  await page.getByRole("button", { name: /Start AI trader/i }).click();
  await page.waitForFunction(() => {
    const state = document.querySelector(".agent-run-state")?.textContent?.toLowerCase();
    return state === "completed" || state === "failed";
  });

  const runState = (await page.locator(".agent-run-state").innerText()).toLowerCase();
  if (runState === "completed") {
    await expect(page.getByLabel("AI trader analysis").getByText("Brooks Generalist")).toBeVisible();
    await expect(page.getByText("Tool actions")).toBeVisible();
    await expect(page.getByText(/Model API: (?!mock)/i)).toBeVisible();
    await expect(page.getByText(/Position size/i)).toBeVisible();
    await expect(page.getByText(/Trade reason/i)).toBeVisible();
    const orderHeader = page.locator(".table-head");
    await expect(orderHeader.getByText("Entry", { exact: true })).toBeVisible();
    await expect(orderHeader.getByText("Stop", { exact: true })).toBeVisible();
    await expect(orderHeader.getByText("Target", { exact: true })).toBeVisible();
  } else {
    await expect(page.locator(".agent-run-error")).toBeVisible();
    await expect(page.locator(".agent-run-error")).not.toContainText("mock");
  }

  await page.screenshot({ path: "test-results/workbench.png", fullPage: true });
});
