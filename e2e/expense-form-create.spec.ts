import { test } from '@playwright/test'
import { expect, getAllExpenses, getMonthOffsetIsoDate, resetAppState } from './helpers'

test.describe('Expense form — full create/edit/delete flow (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page)
  })

  test('fill all fields and save — expense appears on dashboard', async ({ page }) => {
    // Open expense form
    await page.getByTestId('btn-add-expense').first().click()
    await expect(page.getByTestId('expense-form')).toBeVisible()

    // Fill notes
    await page.getByPlaceholder('Optional').fill('Test grocery run')

    // Select a category via the desktop dropdown
    const categoryDropdown = page.getByTestId('desktop-category-dropdown')
    await categoryDropdown.getByRole('button').click()
    await page.getByPlaceholder('Search...').fill('Food')
    await page.getByText('Food').click()

    const amountInput = page.locator('[aria-label="Amount"]')
    await amountInput.click()
    await amountInput.fill('12.34')
    await expect(amountInput).toHaveValue('12.34')

    // Save
    await page.getByTestId('btn-save-expense').click()
    await expect(page.getByTestId('expense-form')).not.toBeVisible({ timeout: 5000 })

    // Verify expense exists via test API
    const expenses = await getAllExpenses(page)
    expect(expenses.length).toBeGreaterThanOrEqual(1)
    const saved = expenses.find((e) => e.notes === 'Test grocery run')
    expect(saved).toBeTruthy()
    expect(Number(saved?.amount)).toBeCloseTo(12.34, 1)
  })

  test('right-click edit modifies expense and persists', async ({ page }) => {
    await resetAppState(page, {
      expenses: [{ date: getMonthOffsetIsoDate(1), amount: 15.5, notes: 'Original lunch' }],
    })

    // Switch to expenses view
    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('expense-table')).toBeVisible()

    // Right-click on the row
    const firstRow = page.locator("[data-testid^='expense-row-']").first()
    await firstRow.click({ button: 'right' })

    // Click Edit (context menu menuitem)
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    // The "Edit" context menu action opens the ExpenseForm modal for editing
    const editDialog = page.getByRole('dialog', { name: 'Edit Expense' })
    await expect(editDialog).toBeVisible({ timeout: 3000 })

    // Change the notes in the edit form
    const notesInput = editDialog.getByPlaceholder('Optional')
    await notesInput.clear()
    await notesInput.fill('Updated lunch')

    // Click Save Changes
    await editDialog.getByTestId('btn-save-expense').click()
    await expect(editDialog).not.toBeVisible({ timeout: 5000 })

    // Verify the update via test API
    const expenses = await getAllExpenses(page)
    const updated = expenses.find((e) => e.notes === 'Updated lunch')
    expect(updated).toBeTruthy()
  })

  test('delete via context menu removes the expense permanently', async ({ page }) => {
    await resetAppState(page, {
      expenses: [{ date: getMonthOffsetIsoDate(1), amount: 25.0, notes: 'To be deleted' }],
    })

    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('expense-table')).toBeVisible()

    const rows = page.locator("[data-testid^='expense-row-']")
    await expect(rows).toHaveCount(1)

    // Right-click and delete
    await rows.first().click({ button: 'right' })
    // The context menu has menuitems — click the Delete menu item
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const confirmDialog = page.getByRole('dialog', { name: 'Confirm Delete' })
    await expect(confirmDialog).toBeVisible()
    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    // Verify it's gone from the table (pending delete hides it immediately)
    await expect(rows).toHaveCount(0)

    // Wait for permanent delete timer and verify via API
    await page.waitForTimeout(5000)

    const expenses = await getAllExpenses(page)
    const deleted = expenses.find((e) => e.notes === 'To be deleted')
    expect(deleted).toBeFalsy()
  })
})
