import { test } from "@playwright/test";
import { expect, resetAppState } from "./helpers";

const CSV_IMPORT_SAMPLE = [
  "date,amount,category,description",
  "2026-04-03,12.45,Food,Coffee shop",
  "2026-04-08,84.10,Transportation,Train pass",
].join("\n");

test.describe("Settings — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, { route: "/settings" });
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

  test("csv import follow-up can be dismissed with guidance to reopen it later", async ({ page }) => {
    await page
      .locator("input[type='file'][accept='.csv']")
      .setInputFiles({
        name: "transactions.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(CSV_IMPORT_SAMPLE, "utf-8"),
      });

    const reviewDialog = page.getByRole("dialog", { name: "Review Import" });
    await expect(reviewDialog).toBeVisible();
    await reviewDialog.getByTestId("btn-import-confirm").click();

    const followUp = page.getByRole("dialog", { name: "Complete Imported Months" });
    await expect(followUp).toBeVisible();
    await followUp.getByRole("button", { name: "Later" }).click();

    await expect(followUp).not.toBeVisible({ timeout: 5000 });
  });

  test("csv import follow-up can open the historical data editor on mobile", async ({ page }) => {
    await page
      .locator("input[type='file'][accept='.csv']")
      .setInputFiles({
        name: "transactions.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(CSV_IMPORT_SAMPLE, "utf-8"),
      });

    const reviewDialog = page.getByRole("dialog", { name: "Review Import" });
    await expect(reviewDialog).toBeVisible();
    await reviewDialog.getByTestId("btn-import-confirm").click();

    const followUp = page.getByRole("dialog", { name: "Complete Imported Months" });
    await expect(followUp).toBeVisible();
    await followUp.getByRole("button", { name: "Review Historical Data" }).click();

    await expect(followUp).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("dialog", { name: "Edit Historical Data" })).toBeVisible();
  });
});
