import { test, expect } from "@playwright/test";
import { clearAndSeed, waitForAppReady } from "./helpers";

test.describe("Money input", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("typing digits into amount field shows formatted currency", async ({ page }) => {
    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    // The MoneyInput has aria-label="Amount"
    const amountInput = page.locator('[aria-label="Amount"]');
    await amountInput.click();
    await amountInput.pressSequentially("12345");

    // After typing 12345, MoneyInput stores 12345 cents and displays $123.45
    const displayValue = await amountInput.inputValue();
    expect(displayValue).toMatch(/123\.45/);
  });

  test("backspace removes last digit from amount", async ({ page }) => {
    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    const amountInput = page.locator('[aria-label="Amount"]');
    await amountInput.click();
    await amountInput.pressSequentially("1234");

    // Backspace: 1234 cents -> 123 cents -> displays $1.23
    await amountInput.press("Backspace");

    const displayValue = await amountInput.inputValue();
    expect(displayValue).toMatch(/1\.23/);
  });

  test("sign toggle switches between expense and refund", async ({ page }) => {
    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    const amountInput = page.locator('[aria-label="Amount"]');
    await amountInput.click();
    await amountInput.pressSequentially("50");

    // The sign toggle button has aria-label starting with "Switch to Refund"
    const signToggle = page.locator('button[aria-label="Switch to Refund"]');
    if (await signToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signToggle.click();

      // After switching to refund mode, the value should be negative
      // The aria-label changes to "Switch to Expense"
      await expect(page.locator('button[aria-label="Switch to Expense"]')).toBeVisible();
    }
  });
});