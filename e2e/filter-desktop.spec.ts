import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("Filter modal (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: "2026-05-01", amount: 15.5, description: "Lunch" },
        { date: "2026-05-02", amount: 42.0, description: "Groceries" },
      ],
    });
  });

  test("filter modal opens, closes, and reset works", async ({ page }) => {
    await page.getByTestId("btn-open-filters").first().click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).toBeVisible();

    const searchInput = page.getByPlaceholder("Description, category, or amount...");
    await searchInput.fill("test query");
    await expect(searchInput).toHaveValue("test query");

    await page.getByTestId("btn-clear-all-filters").click();
    await expect(searchInput).toHaveValue("");

    await page.getByTestId("btn-apply-filters").click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).not.toBeVisible({ timeout: 5000 });
  });

  test("filter by global search text shows active count", async ({ page }) => {
    await page.getByTestId("view-tab-expenses").first().click();
    await expect(page.getByTestId("expense-table")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("btn-open-filters").first().click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).toBeVisible();

    const searchInput = page.getByPlaceholder("Description, category, or amount...");
    await searchInput.fill("Lunch");

    await page.getByTestId("btn-apply-filters").click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).not.toBeVisible({ timeout: 5000 });

    const filterButton = page.getByTestId("btn-open-filters").first();
    await expect(filterButton).toBeVisible();
    const countBadge = filterButton.locator("span");
    await expect(countBadge).toContainText("1");
  });
});
