import { test } from "@playwright/test";
import {
  expect,
  exportAllData,
  resetAppState,
} from "./helpers";

test.describe("Settings — Import/Export", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, { route: "/settings" });
  });

  test("navigate to settings page", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test("export backup button exists on settings page", async ({ page }) => {
    await expect(page.getByTestId("btn-export-backup")).toBeVisible();
  });

  test("import backup button exists on settings page", async ({ page }) => {
    await expect(page.getByTestId("btn-import-backup")).toBeVisible();
  });

  test("clear all data button exists on settings page", async ({ page }) => {
    await expect(page.getByTestId("btn-clear-data")).toBeVisible();
  });

  test("export backup downloads an encrypted file", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");

    await page.getByTestId("btn-export-backup").click();
    await expect(page.getByRole("dialog", { name: "Encrypt Backup" })).toBeVisible();
    await page.getByPlaceholder("Enter password").fill("pass123");
    await page.getByRole("button", { name: "Encrypt & Export" }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^outflow-backup-.*\.ofb$/);
  });

  test("import backup restores expenses through the UI", async ({ page }) => {
    await resetAppState(page, {
      route: "/settings",
      expenses: [
        { date: "2026-05-01", amount: 15.5, description: "Lunch" },
        { date: "2026-05-02", amount: 42.0, description: "Groceries" },
      ],
    });

    const exportData = await exportAllData(page);
    const backupBuffer = Buffer.from(JSON.stringify(exportData, null, 2));

    await page.getByTestId("btn-clear-data").click();
    await expect(page.getByRole("dialog", { name: "Clear All Data" })).toBeVisible();
    await page.getByPlaceholder("DELETE").fill("DELETE");
    await page.getByRole("button", { name: "Clear Everything" }).click();
    await expect(page.getByRole("dialog", { name: "Clear All Data" })).not.toBeVisible({ timeout: 5000 });

    const fileInput = page.locator('input[type="file"][accept=".ofb,.json"]');
    await fileInput.setInputFiles({
      name: "outflow-backup.json",
      mimeType: "application/json",
      buffer: backupBuffer,
    });

    await page.waitForURL(/\/settings/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });

    const restoredData = await exportAllData(page);
    expect((restoredData.expenses as unknown[])?.length).toBeGreaterThanOrEqual(2);
  });
});
