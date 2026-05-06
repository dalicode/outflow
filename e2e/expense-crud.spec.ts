import { test } from "@playwright/test";
import {
  clearAllData,
  expect,
  exportAllData,
  importAllData,
  resetAppState,
} from "./helpers";

test.describe("Expense CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("dashboard renders after clearing data", async ({ page }) => {
    await expect(page.getByTestId("dashboard")).toBeVisible();
  });

  test("add expense button opens form", async ({ page }) => {
    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();
  });

  test("data round-trip: seed, export, clear, re-import", async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: "2026-05-01", amount: 15.5, description: "Lunch" },
        { date: "2026-05-02", amount: 42.0, description: "Groceries" },
      ],
    });

    const data = await exportAllData(page);

    expect((data.expenses as unknown[])?.length).toBeGreaterThanOrEqual(2);

    await clearAllData(page);

    const clearedData = await exportAllData(page);

    expect((clearedData.expenses as unknown[])?.length).toBe(0);

    await importAllData(page, data, { replace: true });

    const restoredData = await exportAllData(page);

    expect((restoredData.expenses as unknown[])?.length).toBeGreaterThanOrEqual(2);
  });
});
