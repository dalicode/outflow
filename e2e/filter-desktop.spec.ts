import { test } from "@playwright/test";
import { expect, resetAppState } from "./helpers";

test.describe("Filter modal (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: "2026-05-01", amount: 15.5, description: "Lunch" },
        { date: "2026-05-02", amount: 42.0, description: "Groceries" },
      ],
    });
  });

  test("filter modal opens and closes", async ({ page }) => {
    await page.getByTestId("btn-open-filters").first().click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).toBeVisible();

    // Close via Done button
    await page.getByTestId("btn-apply-filters").click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).not.toBeVisible({ timeout: 5000 });
  });

  test("clear all filters button resets filters", async ({ page }) => {
    await page.getByTestId("btn-open-filters").first().click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).toBeVisible();

    // Type something in the global search
    const searchInput = page.getByPlaceholder("Description, category, or amount...");
    await searchInput.fill("test query");
    await expect(searchInput).toHaveValue("test query");

    // Click clear all
    await page.getByTestId("btn-clear-all-filters").click();

    // The search input should be cleared
    await expect(searchInput).toHaveValue("");
  });

  test("apply filters and close", async ({ page }) => {
    await page.getByTestId("btn-open-filters").first().click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).toBeVisible();

    // Click Done to apply
    await page.getByTestId("btn-apply-filters").click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).not.toBeVisible({ timeout: 5000 });
  });

  test("filter by global search text shows active count", async ({ page }) => {
    // Switch to expenses view
    await page.getByTestId("view-tab-expenses").first().click();
    await expect(page.getByTestId("expense-table")).toBeVisible({ timeout: 5000 });

    // Open filter
    await page.getByTestId("btn-open-filters").first().click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).toBeVisible();

    // Type in the search field
    const searchInput = page.getByPlaceholder("Description, category, or amount...");
    await searchInput.fill("Lunch");

    // Apply
    await page.getByTestId("btn-apply-filters").click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).not.toBeVisible({ timeout: 5000 });

    // The filter button should show an active count badge
    const filterButton = page.getByTestId("btn-open-filters").first();
    await expect(filterButton).toBeVisible();
    // The count badge is a span with the filter count inside
    const countBadge = filterButton.locator("span");
    await expect(countBadge).toContainText("1");
  });
});
