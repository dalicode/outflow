import { test, expect } from "@playwright/test";

test.describe("Settings — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.getByTestId("settings-page").waitFor({ timeout: 15000 });
  });

  test("settings page renders", async ({ page }) => {
    await expect(page.getByTestId("settings-page")).toBeVisible();
    // The heading should be visible
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("theme selector is visible", async ({ page }) => {
    await expect(page.getByTestId("settings-page")).toBeVisible();
    await expect(page.getByText("Visual Theme")).toBeVisible({ timeout: 5000 });
  });

  test("clear all data button opens confirmation modal", async ({ page }) => {
    await page.getByTestId("btn-clear-data").scrollIntoViewIfNeeded();
    await page.getByTestId("btn-clear-data").click();

    // Confirmation modal should appear
    await expect(page.getByRole("dialog", { name: "Clear All Data" })).toBeVisible();

    // Type DELETE to enable the confirm button
    const confirmInput = page.getByPlaceholder("DELETE");
    await confirmInput.fill("DELETE");

    // The "Clear Everything" button should now be enabled
    const clearButton = page.locator("button", { hasText: "Clear Everything" });
    await expect(clearButton).toBeEnabled();
  });

  test("historical data and schedule buttons are visible", async ({ page }) => {
    await page.getByTestId("btn-open-historical-data").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("btn-open-historical-data")).toBeVisible();

    await page.getByTestId("btn-add-schedule").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("btn-add-schedule")).toBeVisible();
  });
});