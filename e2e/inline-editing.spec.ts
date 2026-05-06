import { test } from "@playwright/test";
import { expect, resetAppState } from "./helpers";

test.describe("Inline editing (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: "2026-05-01", amount: 15.5, description: "Lunch" },
        { date: "2026-05-02", amount: 42.0, description: "Groceries" },
        { date: "2026-05-03", amount: 5.0, description: "Snack" },
      ],
    });

    // Switch to Expenses view to see the table with inline editing
    await page.getByTestId("view-tab-expenses").first().click();
  });

  test("expense table shows seeded data", async ({ page }) => {
    await expect(page.getByTestId("expense-table")).toBeVisible();
    // Should have 3 rows
    const rows = page.locator("[data-testid^='expense-row-']");
    await expect(rows).toHaveCount(3);
  });

  test("click on description cell activates inline editing", async ({ page }) => {
    const firstRow = page.locator("[data-testid^='expense-row-']").first();
    const descCell = firstRow.locator("[data-field='description']");
    await expect(descCell).toBeVisible();

    // Click the description cell to enter edit mode
    await descCell.click();

    // An input should appear (InlineEditCell renders an <input>)
    const input = firstRow.locator("input").first();
    await expect(input).toBeVisible({ timeout: 3000 });
  });

  test("click on amount cell activates money input", async ({ page }) => {
    const firstRow = page.locator("[data-testid^='expense-row-']").first();
    const amountCell = firstRow.locator("[data-field='amount']");
    await expect(amountCell).toBeVisible();

    await amountCell.click();

    // MoneyInput has aria-label="Amount"
    const amountInput = page.locator('[aria-label="Amount"]');
    await expect(amountInput).toBeVisible({ timeout: 3000 });
  });

  test("click on date cell activates date picker", async ({ page }) => {
    const firstRow = page.locator("[data-testid^='expense-row-']").first();
    const dateCell = firstRow.locator("[data-field='date']");
    await expect(dateCell).toBeVisible();

    await dateCell.click();

    // DatePicker trigger should be focused — just verify the cell enters editing
    // by checking that the cell now has the "cell-editing" class
    await expect(firstRow.locator("td").nth(1)).toHaveClass(/cell-editing/, { timeout: 3000 });
  });

  test("Escape cancels description editing", async ({ page }) => {
    const firstRow = page.locator("[data-testid^='expense-row-']").first();
    const descCell = firstRow.locator("[data-field='description']");

    // Get original text
    const originalText = await descCell.textContent();

    // Click to edit
    await descCell.click();
    const input = firstRow.locator("input[type='text']").first();
    await expect(input).toBeVisible({ timeout: 3000 });

    // Clear and type new text
    await input.fill("Changed text");
    expect(await input.inputValue()).toBe("Changed text");

    // Press Escape to cancel
    await input.press("Escape");

    // Original text should be restored
    await expect(descCell).toHaveText(originalText ?? "", { timeout: 3000 });
  });

  test("Enter commits description editing", async ({ page }) => {
    const firstRow = page.locator("[data-testid^='expense-row-']").first();
    const descCell = firstRow.locator("[data-field='description']");

    await descCell.click();
    const input = firstRow.locator("input[type='text']").first();
    await expect(input).toBeVisible({ timeout: 3000 });

    // Clear and type new text
    await input.clear();
    await input.fill("New description");

    // Press Enter to commit
    await input.press("Enter");

    // The description should be updated (cell exits edit mode, shows new text)
    await expect(descCell).toHaveText("New description", { timeout: 3000 });
  });

  test("clicking another cell commits current and switches", async ({ page }) => {
    const firstRow = page.locator("[data-testid^='expense-row-']").first();
    const descCell = firstRow.locator("[data-field='description']");
    const amountCell = firstRow.locator("[data-field='amount']");

    // Click description to start editing
    await descCell.click();
    const input = firstRow.locator("input[type='text']").first();
    await expect(input).toBeVisible({ timeout: 3000 });

    // Now click amount cell — should switch to amount editing
    await amountCell.click();

    // Description edit mode should close, amount edit mode should open
    // MoneyInput has aria-label="Amount"
    const amountInput = page.locator('[aria-label="Amount"]');
    await expect(amountInput).toBeVisible({ timeout: 3000 });
  });

  test("row checkbox toggles selection", async ({ page }) => {
    const firstRow = page.locator("[data-testid^='expense-row-']").first();
    const checkboxLabel = firstRow.locator(".expense-checkbox-wrapper").first();

    // Click the checkbox label (the visible checkbox is a div inside a label)
    await checkboxLabel.click({ force: true });

    // Row should have selected-row class
    await expect(firstRow).toHaveClass(/selected-row/);
  });

  test("select all checkbox toggles all rows", async ({ page }) => {
    // The "Select all" checkbox label is in the header
    const selectAllLabel = page.locator("th .expense-checkbox-wrapper").first();

    // Click to select all
    await selectAllLabel.click({ force: true });

    // All rows should be selected
    const rows = page.locator("[data-testid^='expense-row-']");
    for (let i = 0; i < await rows.count(); i++) {
      await expect(rows.nth(i)).toHaveClass(/selected-row/);
    }

    // Click again to deselect all
    await selectAllLabel.click({ force: true });

    // No rows should be selected
    for (let i = 0; i < await rows.count(); i++) {
      await expect(rows.nth(i)).not.toHaveClass(/selected-row/);
    }
  });

  test("right-click shows context menu", async ({ page }) => {
    const firstRow = page.locator("[data-testid^='expense-row-']").first();
    await expect(firstRow).toBeVisible();

    // Right-click on the row
    await firstRow.click({ button: "right" });

    // Context menu should appear with Edit, Copy, Delete options
    await expect(page.getByText("Edit")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Copy")).toBeVisible();
    await expect(page.getByText("Delete")).toBeVisible();
  });

  test("multiple selection shows bulk context menu", async ({ page }) => {
    // Select two rows via the checkbox labels
    const rows = page.locator("[data-testid^='expense-row-']");
    await rows.nth(0).locator(".expense-checkbox-wrapper").first().click({ force: true });
    await rows.nth(1).locator(".expense-checkbox-wrapper").first().click({ force: true });

    // Right-click on the first selected row
    await rows.nth(0).click({ button: "right" });

    // Context menu should show bulk actions
    await expect(page.getByText(/Edit \d rows/)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Copy \d rows/)).toBeVisible();
    await expect(page.getByText(/Delete \d rows/)).toBeVisible();
  });

  test("Tab navigates between fields in same row", async ({ page }) => {
    const firstRow = page.locator("[data-testid^='expense-row-']").first();
    const dateCell = firstRow.locator("[data-field='date']");

    // Click date cell to start editing
    await dateCell.click();

    // Verify date editor is active (cell-editing class on the cell)
    await expect(firstRow.locator("td").nth(1)).toHaveClass(/cell-editing/, { timeout: 3000 });

    // Press Tab — should move to payee field
    await page.keyboard.press("Tab");

    // The payee field cell should now be in editing mode
    // (payee is column index 2, so the 3rd td)
    await expect(firstRow.locator("td").nth(2)).toHaveClass(/cell-editing/, { timeout: 3000 });
  });

  test("Tab from amount wraps to next row date", async ({ page }) => {
    const rows = page.locator("[data-testid^='expense-row-']");
    const firstRow = rows.first();
    const amountCell = firstRow.locator("[data-field='amount']");

    // Click amount cell to start editing
    await amountCell.click();

    // MoneyInput should be active
    const amountInput = page.locator('[aria-label="Amount"]');
    await expect(amountInput).toBeVisible({ timeout: 3000 });

    // Press Tab — should switch to next row's date cell
    await page.keyboard.press("Tab");

    // The second row's date cell should be in editing mode
    const secondRow = rows.nth(1);
    await expect(secondRow.locator("td").nth(1)).toHaveClass(/cell-editing/, { timeout: 3000 });
  });
});
