import { test } from "@playwright/test";
import { addPayee, expect, resetAppState } from "./helpers";

test.describe("Keyboard navigation (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: "2026-05-03", amount: 12.5, description: "Coffee row" },
        { date: "2026-05-02", amount: 24.75, description: "Lunch row" },
        { date: "2026-05-01", amount: 8.25, description: "Snack row" },
      ],
    });

    await addPayee(page, "Yonder Ledger");
    await addPayee(page, "Zephyr Ledger");

    await page.reload();
    await page.getByTestId("view-tab-expenses").first().click();
    await expect(page.getByTestId("expense-table")).toBeVisible({ timeout: 5000 });
  });

  test("expense table Enter and Shift+Enter commit and move vertically", async ({ page }) => {
    const rows = page.locator("[data-testid^='expense-row-']");
    const firstRow = rows.nth(0);
    const secondRow = rows.nth(1);

    await expect(firstRow.locator("[data-field='description']")).toHaveText("Coffee row");
    await expect(secondRow.locator("[data-field='description']")).toHaveText("Lunch row");

    await firstRow.locator("[data-field='amount']").click();
    const firstAmountInput = firstRow.locator('input[aria-label="Amount"]');
    await expect(firstAmountInput).toBeVisible();
    await firstAmountInput.pressSequentially("1234");
    await firstAmountInput.press("Enter");

    const secondAmountInput = secondRow.locator('input[aria-label="Amount"]');
    await expect(secondAmountInput).toBeVisible();

    await secondAmountInput.pressSequentially("5678");
    await secondAmountInput.press("Shift+Enter");

    await expect(firstAmountInput).toBeVisible();
    await expect(firstAmountInput).toHaveValue(/\$?12\.34/);
    await expect(secondRow.locator("[data-field='amount']")).toContainText("56.78");
  });

  test("inline creatable combobox uses keyboard selection for Enter and Tab flows", async ({
    page,
  }) => {
    const rows = page.locator("[data-testid^='expense-row-']");
    const firstRow = rows.nth(0);
    const secondRow = rows.nth(1);

    await firstRow.locator("[data-field='payeeId']").click();
    const firstPayeeInput = firstRow.getByRole("combobox");
    await expect(firstPayeeInput).toBeVisible();

    await firstPayeeInput.fill("zep");
    await firstPayeeInput.press("Enter");

    await expect(firstRow.locator("[data-field='payeeId']")).toContainText("Zephyr Ledger");
    const secondPayeeInput = secondRow.getByRole("combobox");
    await expect(secondPayeeInput).toBeVisible();

    await secondPayeeInput.fill("yon");
    await secondPayeeInput.press("Tab");

    await expect(secondRow.locator("[data-field='payeeId']")).toContainText("Yonder Ledger");
    const secondCategoryInput = secondRow.getByRole("combobox");
    await expect(secondCategoryInput).toBeVisible();
    await expect(secondCategoryInput).toHaveAttribute("placeholder", /Select category/);
  });

  test("desktop dropdown search highlights and selects via keyboard in the expense form", async ({
    page,
  }) => {
    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    const payeeDropdown = page.getByTestId("desktop-payee-dropdown");
    await payeeDropdown.getByRole("button").click();

    const searchInput = page.getByPlaceholder("Search...").last();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("ledger");

    const yonderOption = page.getByRole("button", { name: "Yonder Ledger" });
    const zephyrOption = page.getByRole("button", { name: "Zephyr Ledger" });

    await expect(yonderOption).toHaveClass(/bg-theme-primary-muted/);
    await searchInput.press("ArrowDown");
    await expect(zephyrOption).toHaveClass(/bg-theme-primary-muted/);

    await searchInput.press("Enter");
    await expect(payeeDropdown.getByRole("button")).toContainText("Zephyr Ledger");
    await expect(searchInput).toBeHidden();
  });
});
