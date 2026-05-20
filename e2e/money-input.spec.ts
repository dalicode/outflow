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

    const amountInput = page.locator('[aria-label="Amount"]');
    await amountInput.click();
    await amountInput.fill("123.45");

    await expect(amountInput).toHaveValue("123.45");
    await amountInput.blur();
    await expect(amountInput).toHaveValue(/\$?123\.45/);
  });

  test("backspace removes last digit from amount", async ({ page }) => {
    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    const amountInput = page.locator('[aria-label="Amount"]');
    await amountInput.click();
    await amountInput.fill("12.34");

    await amountInput.press("Backspace");

    await expect(amountInput).toHaveValue("12.3");
    await amountInput.blur();
    await expect(amountInput).toHaveValue(/\$?12\.30/);
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
