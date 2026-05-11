import { test, expect } from "@playwright/test";
import { clearAndSeed, waitForAppReady } from "./helpers";

test.describe("Smoke tests", () => {
  test("app loads and dashboard is visible", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await expect(page.getByTestId("dashboard")).toBeVisible();
  });

  test("navigation works — all pages reachable", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // On desktop, nav links appear in the sidebar
    // Use .first() because both desktop and mobile nav render the same data-testid
    await page.getByTestId("nav-summary").first().click();
    await expect(page).toHaveURL(/\/summary/);
    await expect(page.getByTestId("summary-page")).toBeVisible();

    await page.getByTestId("nav-dashboard").first().click();
    await expect(page).toHaveURL(/\/$/);

    await page.getByTestId("nav-analytics").first().click();
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.getByTestId("analytics-page")).toBeVisible();

    await page.getByTestId("nav-payees").first().click();
    await expect(page).toHaveURL(/\/payees/);
    await expect(page.getByTestId("payees-page")).toBeVisible();

    await page.getByTestId("nav-settings").first().click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test("add expense button opens expense form", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Use .first() because both desktop and mobile render the same data-testid
    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();
  });

  test("IndexedDB is initialized with default categories", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const categories = await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      return api.getCategories();
    });

    expect(categories.length).toBeGreaterThan(0);
  });
});