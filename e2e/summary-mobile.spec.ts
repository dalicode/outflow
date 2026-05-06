import { test } from "@playwright/test";
import { expect, resetAppState } from "./helpers";

async function navigateToPage(page: import("@playwright/test").Page, path: string) {
  // On mobile, nav links may be in collapsed bottom navigation.
  // Navigate via URL for reliability.
  await page.goto(path);
  // Wait for the app to be ready
  await page.getByTestId("dashboard").waitFor({ timeout: 15000 }).catch(() => {});
  // Some pages don't have dashboard testid, so just wait for the page to load
  await page.waitForLoadState("networkidle");
}

test.describe("Summary/Budget — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, { route: "/summary" });
  });

  test("navigate to summary page via URL", async ({ page }) => {
    await page.goto("/summary");
    await expect(page.getByTestId("summary-page")).toBeVisible();
  });

  test("open income modal from summary", async ({ page }) => {
    await expect(page.getByTestId("summary-page")).toBeVisible();

    await page.getByTestId("btn-open-income-modal").click();
    await expect(page.getByRole("dialog", { name: "Edit Income" })).toBeVisible();
  });

test("set income — modal opens and saves", async ({ page }) => {
    await expect(page.getByTestId("summary-page")).toBeVisible();

    // Open income modal
    await page.getByTestId("btn-open-income-modal").click();
    const dialog = page.getByRole("dialog", { name: "Edit Income" });
    await expect(dialog).toBeVisible();

    // Fill amount
    const amountInput = page.locator("#income-modal-form [aria-label='Amount']");
    await amountInput.click();
    await amountInput.pressSequentially("500000");

    // Save
    await page.getByTestId("btn-save-income").click();

    // Modal should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Income should now be displayed (not "Not set")
    const incomeButton = page.getByTestId("btn-open-income-modal");
    await expect(incomeButton).not.toContainText("Not set");
  });

  test("open savings modal from summary", async ({ page }) => {
    await expect(page.getByTestId("summary-page")).toBeVisible();

    await page.getByTestId("btn-open-savings-modal").click();
    await expect(page.getByRole("dialog", { name: "Edit Auto Savings" })).toBeVisible();
  });

  test("set savings rate and show the saved monthly amount", async ({ page }) => {
    await page.getByTestId("btn-open-income-modal").click();
    const incomeAmountInput = page.locator("#income-modal-form [aria-label='Amount']");
    await incomeAmountInput.click();
    await incomeAmountInput.pressSequentially("500000");
    await page.getByTestId("btn-save-income").click();

    await page.getByTestId("btn-open-savings-modal").click();
    const dialog = page.getByRole("dialog", { name: "Edit Auto Savings" });
    await expect(dialog).toBeVisible();

    await page.locator('#savings-modal-form input[type="number"]').fill("20");
    await page.getByTestId("btn-save-savings").click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("btn-open-savings-modal")).toContainText(/20\.0+%/);
    await expect(page.getByTestId("btn-open-savings-modal")).toContainText("$1,000.00");
  });

  test("add a fixed expense — modal opens with fields", async ({ page }) => {
    await expect(page.getByTestId("summary-page")).toBeVisible();

    // Click add fixed expense
    await page.getByTestId("btn-add-fixed-expense").click();

    // Modal should open
    const dialog = page.getByRole("dialog", { name: "Add Fixed Expense" });
    await expect(dialog).toBeVisible();

    // Verify name input exists
    const nameInput = page.locator("#fixed-expense-form input[type='text']");
    await expect(nameInput).toBeVisible();

    // Verify amount input exists
    const amountInput = page.locator('[aria-label="Amount"]');
    await expect(amountInput).toBeVisible();

    // Verify Add button exists
    await expect(dialog.locator("button", { hasText: "Add" })).toBeVisible();
  });

  test("add a fixed expense and show it in the budget list", async ({ page }) => {
    await page.getByTestId("btn-add-fixed-expense").click();
    const dialog = page.getByRole("dialog", { name: "Add Fixed Expense" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("textbox", { name: "Name" }).fill("Rent");
    const amountInput = dialog.locator('[aria-label="Amount"]');
    await amountInput.click();
    await amountInput.pressSequentially("120000");
    await expect(amountInput).toHaveValue(/\$1,200\.00/);
    await dialog.getByRole("button", { name: "Add" }).click();

    const fixedExpenseRow = page.locator("li").filter({ hasText: "Rent" });
    await expect(fixedExpenseRow).toBeVisible();
    await expect(fixedExpenseRow.getByText("$1,200.00")).toBeVisible();
  });

  test("income, savings, and fixed expense update the budget breakdown correctly", async ({ page }) => {
    await page.getByTestId("btn-open-income-modal").click();
    const incomeDialog = page.getByRole("dialog", { name: "Edit Income" });
    await expect(incomeDialog).toBeVisible();

    const incomeAmountInput = page.locator("#income-modal-form [aria-label='Amount']");
    await incomeAmountInput.click();
    await incomeAmountInput.pressSequentially("500000");
    await page.getByTestId("btn-save-income").click();
    await expect(incomeDialog).not.toBeVisible({ timeout: 5000 });

    await page.getByTestId("btn-open-savings-modal").click();
    const savingsDialog = page.getByRole("dialog", { name: "Edit Auto Savings" });
    await expect(savingsDialog).toBeVisible();

    await page.locator('#savings-modal-form input[type="number"]').fill("20");
    await page.getByTestId("btn-save-savings").click();
    await expect(savingsDialog).not.toBeVisible({ timeout: 5000 });

    await page.getByTestId("btn-add-fixed-expense").click();
    const fixedDialog = page.getByRole("dialog", { name: "Add Fixed Expense" });
    await expect(fixedDialog).toBeVisible();

    await fixedDialog.getByRole("textbox", { name: "Name" }).fill("Rent");
    const fixedAmountInput = fixedDialog.locator('[aria-label="Amount"]');
    await fixedAmountInput.click();
    await fixedAmountInput.pressSequentially("120000");
    await fixedDialog.getByRole("button", { name: "Add" }).click();

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
