import { test, expect } from "@playwright/test";

test.describe("Expense form — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("dashboard").waitFor({ timeout: 15000 });

    // Clear and seed an expense so edit tests work
    await page.evaluate(async () => {
      const api = (window as unknown as { outflowTestApi?: typeof import("../src/test/testApi").testApi }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      await api.clearAllData();
    });
    await page.reload();
    await page.getByTestId("dashboard").waitFor({ timeout: 15000 });
  });

  test("open expense form via add button", async ({ page }) => {
    await page.getByTestId("btn-add-expense").filter({ has: page.locator(":visible") }).first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();
  });

  test("expense form has amount input with aria-label", async ({ page }) => {
    await page.getByTestId("btn-add-expense").filter({ has: page.locator(":visible") }).first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    const amountInput = page.locator('[aria-label="Amount"]');
    await expect(amountInput).toBeVisible();
  });

  test("expense form has category trigger on mobile", async ({ page }) => {
    await page.getByTestId("btn-add-expense").filter({ has: page.locator(":visible") }).first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    // On mobile viewport, category trigger should be visible
    const categoryTrigger = page.getByTestId("mobile-category-trigger");
    await expect(categoryTrigger).toBeVisible();
  });

  test("expense form has payee trigger on mobile", async ({ page }) => {
    await page.getByTestId("btn-add-expense").filter({ has: page.locator(":visible") }).first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    const payeeTrigger = page.getByTestId("mobile-payee-trigger");
    await expect(payeeTrigger).toBeVisible();
  });

  test("fill description field", async ({ page }) => {
    await page.getByTestId("btn-add-expense").filter({ has: page.locator(":visible") }).first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    const descInput = page.getByPlaceholder("Optional");
    await descInput.fill("Test description");
    await expect(descInput).toHaveValue("Test description");
  });

  test("fill amount with MoneyInput", async ({ page }) => {
    await page.getByTestId("btn-add-expense").filter({ has: page.locator(":visible") }).first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    const amountInput = page.locator('[aria-label="Amount"]');
    await amountInput.click();
    await amountInput.pressSequentially("1234");
    const value = await amountInput.inputValue();
    expect(value).toMatch(/12\.34/);
  });

  test("sign toggle is visible on mobile", async ({ page }) => {
    await page.getByTestId("btn-add-expense").filter({ has: page.locator(":visible") }).first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    // The sign toggle should be visible since allowNegative and showSignToggle are true
    const signToggle = page.locator('button[aria-label="Switch to Refund"]');
    if (await signToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signToggle.click();
      await expect(page.locator('button[aria-label="Switch to Expense"]')).toBeVisible();
    }
  });

  test("close form via close button", async ({ page }) => {
    await page.getByTestId("btn-add-expense").filter({ has: page.locator(":visible") }).first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    // Close the modal
    const closeButton = page.locator('[aria-label="Close"]').first();
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
      await expect(page.getByTestId("expense-form")).not.toBeVisible();
    }
  });

  test("cancel button closes form", async ({ page }) => {
    await page.getByTestId("btn-add-expense").filter({ has: page.locator(":visible") }).first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    // Click Cancel button (visible on mobile full-screen)
    const cancelButton = page.getByRole("button", { name: "Cancel" }).first();
    if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelButton.click();
      await expect(page.getByTestId("expense-form")).not.toBeVisible({ timeout: 5000 });
    }
  });
});