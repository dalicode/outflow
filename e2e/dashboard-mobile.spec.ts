import { test } from "@playwright/test";
import {
  expect,
  openMobileSecondaryNav,
  resetAppState,
} from "./helpers";

test.describe("Dashboard — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("mobile nav renders with add expense button", async ({ page }) => {
    await expect(page.getByTestId("btn-add-expense").filter({ has: page.locator(":visible") }).first()).toBeVisible();
  });

  test("dashboard renders on mobile viewport", async ({ page }) => {
    await expect(page.getByTestId("dashboard")).toBeVisible();
  });

  test("categories exist after app initialization", async ({ page }) => {
    const categories = await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      return api.getCategories();
    });
    expect(categories.length).toBeGreaterThan(0);
  });

  test("switch between view tabs", async ({ page }) => {
    // Default view should be categories
    await expect(page.getByTestId("view-tab-categories")).toBeVisible();

    // Switch to payees view
    await page.getByTestId("view-tab-payees").first().click();

    // Switch to expenses view
    await page.getByTestId("view-tab-expenses").first().click();
    await expect(page.getByTestId("view-tab-expenses").first()).toHaveClass(/bg-theme-surface/);
  });

  test("open filter modal", async ({ page }) => {
    await page.getByTestId("btn-open-filters").first().click();
    // Filter modal opens with title "Filter Transactions"
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).toBeVisible();
  });

  test("expanded second-row nav icons respond immediately", async ({ page }) => {
    await openMobileSecondaryNav(page);
    await page.locator(".mobile-nav-row-secondary").getByTestId("nav-settings").click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByTestId("settings-page")).toBeVisible();
  });

  test("expenses view shows seeded mobile rows", async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: "2026-05-01", amount: 10.0, description: "Coffee" },
        { date: "2026-05-02", amount: 25.0, description: "Lunch" },
        { date: "2026-05-03", amount: 5.0, description: "Snack" },
      ],
    });

    await page.getByTestId("view-tab-expenses").first().click();
    const expenseRows = page.locator("[data-testid^='expense-row-mobile-']");
    await expect(expenseRows).toHaveCount(3);
  });
});
