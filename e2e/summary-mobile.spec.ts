import { test, expect } from "@playwright/test";

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
    await page.goto("/");
    await page.getByTestId("dashboard").waitFor({ timeout: 15000 });
  });

  test("navigate to summary page via URL", async ({ page }) => {
    await page.goto("/summary");
    await expect(page.getByTestId("summary-page")).toBeVisible();
  });

  test("open income modal from summary", async ({ page }) => {
    await page.goto("/summary");
    await expect(page.getByTestId("summary-page")).toBeVisible();

    await page.getByTestId("btn-open-income-modal").click();
    await expect(page.getByRole("dialog", { name: "Edit Income" })).toBeVisible();
  });

test("set income — modal opens and saves", async ({ page }) => {
    await page.goto("/summary");
    await expect(page.getByTestId("summary-page")).toBeVisible();

    // Open income modal
    await page.getByTestId("btn-open-income-modal").click();
    const dialog = page.getByRole("dialog", { name: "Edit Income" });
    await expect(dialog).toBeVisible();

    // Fill amount
    const amountInput = page.locator('#income-modal-form input[type="number"]');
    await amountInput.fill("5000");

    // Save
    await page.getByTestId("btn-save-income").click();

    // Modal should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Income should now be displayed (not "Not set")
    const incomeButton = page.getByTestId("btn-open-income-modal");
    await expect(incomeButton).not.toContainText("Not set");
  });

  test("open savings modal from summary", async ({ page }) => {
    await page.goto("/summary");
    await expect(page.getByTestId("summary-page")).toBeVisible();

    await page.getByTestId("btn-open-savings-modal").click();
    await expect(page.getByRole("dialog", { name: "Edit Auto Savings" })).toBeVisible();
  });

  test("add a fixed expense — modal opens with fields", async ({ page }) => {
    await page.goto("/summary");
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
});