import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("Analytics page (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: "2025-01-15", amount: 100.0, description: "Jan 2025 expense" },
        { date: "2025-06-10", amount: 200.0, description: "Jun 2025 expense" },
        { date: "2026-01-05", amount: 50.0, description: "Jan 2026 expense" },
        { date: "2026-02-10", amount: 75.0, description: "Feb 2026 expense" },
        { date: "2026-03-15", amount: 120.0, description: "Mar 2026 expense" },
        { date: "2026-04-01", amount: 30.0, description: "Apr 2026 expense" },
      ],
      settings: {
        monthlyIncome: 5000,
        savingsRate: 15,
      },
    });
  });

  test("analytics full page: rendering, year nav, and chart drilldown", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.getByTestId("analytics-page")).toBeVisible({ timeout: 15000 });

    // Income trend section renders with data
    const trendSection = page.getByTestId("income-trend-section");
    await expect(trendSection).toBeVisible({ timeout: 10000 });
    await expect(trendSection.getByText("Savings:")).toBeVisible();
    await expect(trendSection.getByText("Category Movement")).toBeVisible();

    // Year strip shows available years
    const year2026 = page.getByLabel("2026");
    await expect(year2026).toBeVisible({ timeout: 5000 });
    const year2025 = page.getByLabel("2025");
    await expect(year2025).toBeVisible({ timeout: 5000 });

    // Navigate to 2025
    await year2025.click();
    await expect(page.getByTestId("income-trend-section")).toBeVisible({ timeout: 10000 });
    await expect(trendSection.getByText("-$300.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Jun 2025 expense")).toBeVisible();
    await expect(page.getByText("$200.00").first()).toBeVisible();

    // Navigate back to 2026
    await page.getByLabel("2026").click();
    await expect(page.getByTestId("income-trend-section")).toBeVisible({ timeout: 10000 });
    await expect(trendSection.getByText("$4,725.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Mar 2026 expense")).toBeVisible();
    await expect(page.getByText("$120.00").first()).toBeVisible();

    // Month bar click → preview → drilldown → back
    const monthBarRects = page.locator(".recharts-bar-rectangle rect");
    const barCount = await monthBarRects.count();

    if (barCount > 0) {
      await monthBarRects.first().click({ force: true });

      const monthPreview = page.getByTestId("income-trend-month-preview");
      await expect(monthPreview).toBeVisible({ timeout: 5000 });
      await expect(monthPreview).toContainText("Jan 2026");
      await expect(monthPreview).toContainText("-$350.00");

      const viewMonthBtn = page.getByTestId("income-trend-view-month-btn");
      await expect(viewMonthBtn).toBeVisible({ timeout: 3000 });
      await viewMonthBtn.click();

      const drilldown = page.getByTestId("income-trend-drilldown");
      await expect(drilldown).toBeVisible({ timeout: 5000 });
      await expect(drilldown).toContainText("Jan");
      await expect(drilldown).toContainText("-$350.00");
      await expect(drilldown).toContainText("Jan 2026 expense");

      const backBtn = page.getByTestId("income-trend-back-btn");
      await expect(backBtn).toBeVisible();
      await backBtn.click();
      await expect(drilldown).not.toBeVisible({ timeout: 3000 });
    }
  });
});
