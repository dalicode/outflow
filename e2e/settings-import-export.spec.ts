import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers";

test.describe("Settings — Import/Export", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("navigate to settings page", async ({ page }) => {
    await page.getByTestId("nav-settings").click();
    await expect(page.getByTestId("settings-page")).toBeVisible();
  });

  test("export backup button exists on settings page", async ({ page }) => {
    await page.getByTestId("nav-settings").click();
    await expect(page.getByTestId("btn-export-backup")).toBeVisible();
  });

  test("import backup button exists on settings page", async ({ page }) => {
    await page.getByTestId("nav-settings").click();
    await expect(page.getByTestId("btn-import-backup")).toBeVisible();
  });

  test("clear all data button exists on settings page", async ({ page }) => {
    await page.getByTestId("nav-settings").click();
    await expect(page.getByTestId("btn-clear-data")).toBeVisible();
  });

  test("export data returns expected structure", async ({ page }) => {
    await waitForAppReady(page);

    const data = await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      return api.exportAllData();
    });

    expect(data).toHaveProperty("expenses");
    expect(data).toHaveProperty("categories");
    expect(data).toHaveProperty("payees");
  });
});