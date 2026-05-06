import { test, expect } from "@playwright/test";

test.describe("Expense CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the app to be ready (dashboard appears)
    await page.getByTestId("dashboard").waitFor({ timeout: 15000 });

    // Clear all data through the test API
    await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      await api.clearAllData();
    });

    // Reload to reset the app state
    await page.reload();
    await page.getByTestId("dashboard").waitFor({ timeout: 15000 });
  });

  test("dashboard renders after clearing data", async ({ page }) => {
    await expect(page.getByTestId("dashboard")).toBeVisible();
  });

  test("add expense button opens form", async ({ page }) => {
    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();
  });

  test("data round-trip: seed, export, clear, re-import", async ({ page }) => {
    // Get category ID
    const categoryId = await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      const categories = await api.getCategories();
      return categories[0]?.id;
    });

    if (!categoryId) return;

    // Seed some expenses
    await page.evaluate(async ({ catId }) => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      await api.seedExpenses([
        { date: "2026-05-01", amount: 15.5, categoryId: catId as number, description: "Lunch" },
        { date: "2026-05-02", amount: 42.0, categoryId: catId as number, description: "Groceries" },
      ]);
    }, { catId: categoryId });

    // Export data
    const data = await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      return api.exportAllData();
    });

    expect(data.expenses.length).toBeGreaterThanOrEqual(2);

    // Clear data
    await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      await api.clearAllData();
    });

    // Verify cleared
    const clearedData = await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      return api.exportAllData();
    });

    expect(clearedData.expenses.length).toBe(0);

    // Re-import
    await page.evaluate(async (importData) => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      await api.importAllData(importData as Record<string, unknown>, { replace: true });
    }, data as unknown as Record<string, unknown>);

    // Verify restored
    const restoredData = await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      return api.exportAllData();
    });

    expect(restoredData.expenses.length).toBeGreaterThanOrEqual(2);
  });
});