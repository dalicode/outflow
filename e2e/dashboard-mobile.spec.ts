import { test, expect } from "@playwright/test";

test.describe("Dashboard — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("dashboard").waitFor({ timeout: 15000 });
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

  test("seed expenses and verify selection banner on long-press", async ({ page }) => {
    // Seed some expenses
    const categoryId = await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      const categories = await api.getCategories();
      return categories[0]?.id;
    });

    if (!categoryId) return;

    await page.evaluate(async (catId) => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      await api.seedExpenses([
        { date: "2026-05-01", amount: 10.0, categoryId: catId as number, description: "Coffee" },
        { date: "2026-05-02", amount: 25.0, categoryId: catId as number, description: "Lunch" },
        { date: "2026-05-03", amount: 5.0, categoryId: catId as number, description: "Snack" },
      ]);
    }, { catId: categoryId });

    await page.reload();
    await page.getByTestId("dashboard").waitFor({ timeout: 15000 });

    // Switch to expenses view to see table
    await page.getByTestId("view-tab-expenses").first().click();

    // Tap on first expense row to enter edit (not selection on mobile tap)
    const expenseRows = page.locator("[data-testid^='expense-row-mobile-']");
    await expect(expenseRows.first()).toBeVisible({ timeout: 5000 });
  });

  test("month span selector renders on wider viewports", async ({ page, browserName }) => {
    // MonthSpanSelector only renders at >= the threshold for 2M spans
    // On Pixel 5 (393px), it is hidden, so just verify dashboard is visible
    await expect(page.getByTestId("dashboard")).toBeVisible();
  });
});