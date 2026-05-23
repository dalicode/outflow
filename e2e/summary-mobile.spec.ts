import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("Summary/Budget — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, { route: "/summary" });
  });

  test("income, savings, and fixed expense update the budget breakdown correctly", async ({ page }) => {
    await expect(page.getByTestId("summary-page")).toBeVisible();

    // Add a fixed expense first (before budget setup switches to compact mode)
    await page.getByTestId("btn-add-fixed-expense").click();
    const initialFixedManageDialog = page.getByRole("dialog", { name: "Fixed Expenses" });
    await expect(initialFixedManageDialog).toBeVisible();
    await initialFixedManageDialog.getByRole("button", { name: "Add", exact: true }).click();
    const fixedDialog = page.getByRole("dialog", { name: "Add Fixed Expense" });
    await expect(fixedDialog).toBeVisible();
    await expect(fixedDialog.locator('input[type="text"]')).toBeVisible();
    await expect(fixedDialog.locator('[aria-label="Amount"]')).toBeVisible();

    await fixedDialog.getByRole("textbox", { name: "Name" }).fill("Rent");
    const fixedAmountInput = fixedDialog.locator('[aria-label="Amount"]');
    await fixedAmountInput.click();
    await fixedAmountInput.fill("1200");
    await expect(fixedAmountInput).toHaveValue("1200");
    await fixedDialog.getByRole("button", { name: "Add" }).click();
    await expect(fixedDialog).not.toBeVisible({ timeout: 5000 });
    await expect(initialFixedManageDialog).toBeVisible();
    await initialFixedManageDialog.getByLabel("Close").click();
    await expect(initialFixedManageDialog).not.toBeVisible({ timeout: 5000 });

    // Set income
    await page.getByTestId("btn-open-income-modal").click();
    const incomeAmountInput = page.locator("#income-modal-form [aria-label='Amount']");
    await expect(incomeAmountInput).toBeVisible();
    await incomeAmountInput.click();
    await incomeAmountInput.fill("5000");
    await page.getByTestId("btn-save-income").click();
    await expect(page.locator("#income-modal-form")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Monthly Budget", { exact: true })).toBeVisible();

    // Set savings rate from BudgetFlow
    await page.getByLabel("Edit savings goal").click();
    const savingsRateInput = page.getByLabel('Savings rate percentage');
    await expect(savingsRateInput).toBeVisible();
    await savingsRateInput.click();
    await savingsRateInput.press('Backspace');
    await savingsRateInput.pressSequentially('2000');
    await page.getByTestId("btn-save-savings").click();
    await expect(page.getByTestId("savings-form")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("$1,000.00")).toBeVisible();

    // Fixed expense path from BudgetFlow should show the existing item and allow adding entries.
    await page.getByLabel("Edit fixed expenses").click();
    const fixedManageDialog = page.getByRole("dialog", { name: "Fixed Expenses" });
    await expect(fixedManageDialog).toBeVisible();
    await expect(fixedManageDialog).toContainText("Rent");
    await expect(fixedManageDialog.getByRole("button", { name: "Add", exact: true })).toBeVisible();
    await fixedManageDialog.getByRole("button", { name: "Add", exact: true }).click();
    const addFixedDialog = page.getByRole("dialog", { name: "Add Fixed Expense" });
    await expect(addFixedDialog).toBeVisible();
    await addFixedDialog.getByRole("textbox", { name: "Name" }).fill("Internet");
    const compactFixedAmountInput = addFixedDialog.locator('[aria-label="Amount"]');
    await compactFixedAmountInput.click();
    await compactFixedAmountInput.fill("85");
    await addFixedDialog.getByRole("button", { name: "Add" }).click();
    await expect(addFixedDialog).not.toBeVisible({ timeout: 5000 });
    await expect(fixedManageDialog).toBeVisible();
    await fixedManageDialog.getByText("Close").click();
    await expect(fixedManageDialog).not.toBeVisible({ timeout: 5000 });

    // Verify budget breakdown
    const budgetCard = page.locator("div").filter({
      has: page.getByText("Monthly Budget", { exact: true }),
    }).first();
    await expect(budgetCard.getByText("Monthly Budget", { exact: true })).toBeVisible();
    await expect(budgetCard).toContainText("$5,000.00");
    await expect(budgetCard).toContainText("+$2,715.00");
    await expect(budgetCard).toContainText("Fixed Expenses");
    await expect(budgetCard).toContainText("$1,285.00");
    await expect(budgetCard).toContainText("Auto Savings");
    await expect(budgetCard).toContainText("$1,000.00");
  });
});
