import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("Summary/Budget — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, { route: "/summary" });
  });

  test("income, savings, and fixed expense update the budget breakdown correctly", async ({ page }) => {
    await expect(page.getByTestId("summary-page")).toBeVisible();

    // Set income
    await page.getByTestId("btn-open-income-modal").click();
    const incomeDialog = page.getByRole("dialog", { name: "Edit Income" });
    await expect(incomeDialog).toBeVisible();

    const incomeAmountInput = page.locator("#income-modal-form [aria-label='Amount']");
    await incomeAmountInput.click();
    await incomeAmountInput.pressSequentially("500000");
    await page.getByTestId("btn-save-income").click();
    await expect(incomeDialog).not.toBeVisible({ timeout: 5000 });
    const incomeButton = page.getByTestId("btn-open-income-modal");
    await expect(incomeButton).not.toContainText("Not set");

    // Set savings rate
    await page.getByTestId("btn-open-savings-modal").click();
    const savingsDialog = page.getByRole("dialog", { name: "Edit Auto Savings" });
    await expect(savingsDialog).toBeVisible();

    await page.getByLabel('Savings rate percentage').click();
    await page.getByLabel('Savings rate percentage').press('Backspace');
    await page.getByLabel('Savings rate percentage').pressSequentially('2000');
    await page.getByTestId("btn-save-savings").click();
    await expect(savingsDialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("btn-open-savings-modal")).toContainText(/20\.0+%/);
    await expect(page.getByTestId("btn-open-savings-modal")).toContainText("$1,000.00");

    // Add a fixed expense
    await page.getByTestId("btn-add-fixed-expense").click();
    const fixedDialog = page.getByRole("dialog", { name: "Add Fixed Expense" });
    await expect(fixedDialog).toBeVisible();
    await expect(fixedDialog.locator('input[type="text"]')).toBeVisible();
    await expect(fixedDialog.locator('[aria-label="Amount"]')).toBeVisible();

    await fixedDialog.getByRole("textbox", { name: "Name" }).fill("Rent");
    const fixedAmountInput = fixedDialog.locator('[aria-label="Amount"]');
    await fixedAmountInput.click();
    await fixedAmountInput.pressSequentially("120000");
    await expect(fixedAmountInput).toHaveValue(/\$1,200\.00/);
    await fixedDialog.getByRole("button", { name: "Add" }).click();

    const fixedExpenseRow = page.locator("li").filter({ hasText: "Rent" });
    await expect(fixedExpenseRow).toBeVisible();
    await expect(fixedExpenseRow.getByText("$1,200.00")).toBeVisible();

    // Verify budget breakdown
    const budgetCard = page.locator("div").filter({
      has: page.getByText("Monthly Budget", { exact: true }),
    }).first();
    await expect(budgetCard.getByText("Monthly Budget", { exact: true })).toBeVisible();
    await expect(budgetCard).toContainText("$5,000.00");
    await expect(budgetCard).toContainText("+$2,800.00");
    await expect(budgetCard).toContainText("Fixed Expenses");
    await expect(budgetCard).toContainText("$1,200.00");
    await expect(budgetCard).toContainText("Auto Savings");
    await expect(budgetCard).toContainText("$1,000.00");
  });
});
