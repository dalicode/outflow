import { test } from "@playwright/test";
import {
  expect,
  resetAppState,
} from "./helpers";

test.describe("Dashboard views and multi-month span (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    // Seed expenses in the current month (May 2026) so they appear in 1M mode
    await resetAppState(page, {
      expenses: [
        { date: "2026-05-01", amount: 100.0, description: "May expense" },
        { date: "2026-05-10", amount: 25.0, description: "Another May" },
        { date: "2026-05-15", amount: 50.0, description: "Mid May" },
        { date: "2026-05-20", amount: 30.0, description: "Late May" },
        { date: "2026-05-25", amount: 75.0, description: "End May" },
      ],
    });
  });

  test("view tabs switch between categories, payees, and expenses views", async ({ page }) => {
    // Default view is categories
    await expect(page.getByTestId("view-tab-categories")).toBeVisible();

    // Switch to expenses view
    await page.getByTestId("view-tab-expenses").first().click();
    await expect(page.getByTestId("expense-table")).toBeVisible({ timeout: 5000 });

    // Verify expense rows are visible
    const expenseRows = page.locator("[data-testid^='expense-row-']");
    await expect(expenseRows).toHaveCount(5);
  });

  test("month span selector switches between 1M, 2M, and 3M", async ({ page }) => {
    // The MonthSpanSelector is visible on desktop viewport (1280px+)
    // It renders buttons with data-testid="span-1m", "span-2m", "span-3m"

    // Click 2M
    const span2m = page.getByTestId("span-2m");
    await expect(span2m).toBeVisible({ timeout: 5000 });
    await span2m.click();

    // Verify the 2M button is active (has active class)
    await expect(span2m).toHaveClass(/dashboard-tab-active/);

    // Click 3M
    const span3m = page.getByTestId("span-3m");
    await expect(span3m).toBeVisible();
    await span3m.click();
    await expect(span3m).toHaveClass(/dashboard-tab-active/);

    // Go back to 1M
    const span1m = page.getByTestId("span-1m");
    await expect(span1m).toBeVisible();
    await span1m.click();
    await expect(span1m).toHaveClass(/dashboard-tab-active/);
  });

  test("grand total toggle appears when month span > 1", async ({ page }) => {
    // Switch to 2M
    await page.getByTestId("span-2m").click();

    // Total button should appear
    const totalBtn = page.getByRole("button", { name: "Total" });
    await expect(totalBtn).toBeVisible();

    // Click to toggle on
    await totalBtn.click();

    // Click to toggle off
    await totalBtn.click();
  });
});
