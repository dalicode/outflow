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

    const planButton = page.getByLabel("Edit monthly plan");
    await expect(planButton).toContainText("Plan");
    await expect(planButton).toContainText("Fixed $1,200");

    await planButton.click();
    const planDialog = page.getByRole("dialog", { name: "Monthly Plan" });
    await expect(planDialog).toBeVisible();

    // Set income
    await planDialog.getByTestId("btn-open-income-modal").click();
    const incomeAmountInput = page.locator("#income-modal-form [aria-label='Amount']");
    await expect(incomeAmountInput).toBeVisible();
    await incomeAmountInput.click();
    await incomeAmountInput.pressSequentially("500000");
    await page.getByTestId("btn-save-income").click();
    await expect(page.locator("#income-modal-form")).not.toBeVisible({ timeout: 5000 });
    const incomeButton = planDialog.getByTestId("btn-open-income-modal");
    await expect(incomeButton).not.toContainText("Not set");

    // Set savings rate
    await planDialog.getByTestId("btn-open-savings-modal").click();
    const savingsRateInput = page.getByLabel('Savings rate percentage');
    await expect(savingsRateInput).toBeVisible();
    await savingsRateInput.click();
    await savingsRateInput.press('Backspace');
    await savingsRateInput.pressSequentially('2000');
    await page.getByTestId("btn-save-savings").click();
    await expect(page.getByTestId("savings-form")).not.toBeVisible({ timeout: 5000 });
    const savingsButton = planDialog.getByTestId("btn-open-savings-modal");
    await expect(savingsButton).toContainText(/20\.0+%/);
    await expect(savingsButton).toContainText("$1,000.00");

    // Compact fixed expense path should still allow editing and adding entries.
    await planDialog.getByLabel("Edit fixed expenses").click();
    const fixedManageDialog = page.getByRole("dialog", { name: "Fixed Expenses" });
    await expect(fixedManageDialog).toBeVisible();
    await expect(fixedManageDialog.getByRole("button", { name: "Add" })).toBeVisible();

    await fixedManageDialog.getByRole("button", { name: "Edit Rent" }).click();
    const editFixedDialog = page.getByRole("dialog", { name: "Edit Fixed Expense" });
    await expect(editFixedDialog).toBeVisible();
    await editFixedDialog.getByRole("textbox", { name: "Name" }).fill("Mortgage");
    await editFixedDialog.getByRole("button", { name: "Save" }).click();
    await expect(editFixedDialog).not.toBeVisible({ timeout: 5000 });
    const fixedManageDialogAfterEdit = page.getByRole("dialog", { name: "Fixed Expenses" });
    await expect(fixedManageDialogAfterEdit).toBeVisible();
    await expect(fixedManageDialogAfterEdit).toContainText("Mortgage");
    await fixedManageDialogAfterEdit.getByRole("button", { name: "Add" }).click();
    const addFixedDialog = page.getByRole("dialog", { name: "Add Fixed Expense" });
    await expect(addFixedDialog).toBeVisible();
    await addFixedDialog.getByRole("textbox", { name: "Name" }).fill("Internet");
    const compactFixedAmountInput = addFixedDialog.locator('[aria-label="Amount"]');
    await compactFixedAmountInput.click();
    await compactFixedAmountInput.pressSequentially("8500");
    await addFixedDialog.getByRole("button", { name: "Add" }).click();
    await expect(addFixedDialog).not.toBeVisible({ timeout: 5000 });
    await expect(fixedManageDialogAfterEdit).toBeVisible();
    await fixedManageDialogAfterEdit.getByText("Close").click();
    await expect(fixedManageDialogAfterEdit).not.toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Done" }).click();
    await expect(planDialog).not.toBeVisible({ timeout: 5000 });
    await expect(planButton).toContainText("Inc. $5,000");
    await expect(planButton).toContainText("Sav. $1,000");
    await expect(planButton).toContainText("Fixed $1,285");

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
