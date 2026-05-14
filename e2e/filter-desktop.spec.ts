import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("Filter modal (desktop)", () => {
  const visibleFiltersButton = (page: import("@playwright/test").Page) =>
    page.getByTestId("btn-open-filters").filter({ visible: true }).first();

  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: "2026-05-01", amount: 15.5, description: "Lunch" },
        { date: "2026-05-02", amount: 42.0, description: "Groceries" },
      ],
    });
  });

  test("filter modal opens, closes, and reset works", async ({ page }) => {
    await visibleFiltersButton(page).click();
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

    await visibleFiltersButton(page).click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).toBeVisible();

    const searchInput = page.getByPlaceholder("Description, category, or amount...");
    await searchInput.fill("Lunch");

    await page.getByTestId("btn-apply-filters").click();
    await expect(page.getByRole("dialog", { name: "Filter Transactions" })).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText("Lunch")).toBeVisible();
    await expect(page.getByText("Groceries")).toHaveCount(0);

    const filterButton = visibleFiltersButton(page);
    await expect(filterButton).toBeVisible();
    await expect(filterButton).toContainText("1");
  });
});
