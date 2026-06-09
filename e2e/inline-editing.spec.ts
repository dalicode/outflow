import { test, expect } from '@playwright/test'
import { getMonthOffsetIsoDate, resetAppState } from './helpers'

test.describe('Inline editing (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: getMonthOffsetIsoDate(1), amount: 15.5, notes: 'Lunch' },
        { date: getMonthOffsetIsoDate(2), amount: 42.0, notes: 'Groceries' },
        { date: getMonthOffsetIsoDate(3), amount: 5.0, notes: 'Snack' },
      ],
    })

    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('expense-table')).toBeVisible()
  })

  test('inline editing keyboard and click interactions on a single row', async ({ page }) => {
    const rows = page.locator("[data-testid^='expense-row-']")
    await expect(rows.first()).toBeVisible({ timeout: 10000 })
    const firstRow = rows.first()

    // Wait for the first row's notes text to appear
    const notesCell = firstRow.locator("[data-field='notes']")
    await expect(notesCell).toHaveText('Snack', { timeout: 5000 })

    // Click notes cell -> inline edit -> Escape cancels, original text restored
    await notesCell.click()
    const input = firstRow.locator("input[type='text']").first()
    await expect(input).toBeVisible({ timeout: 3000 })
    await input.fill('Changed text')
    await input.press('Escape')
    await expect(notesCell).toHaveText('Snack', { timeout: 3000 })

    // Date cell activates date picker
    await firstRow.locator("[data-field='date']").click()
    await expect(firstRow.locator('td').nth(1)).toHaveClass(/cell-editing/, { timeout: 3000 })

    // Amount cell activates money input
    await firstRow.locator("[data-field='amount']").click()
    await expect(page.locator('[aria-label="Amount"]')).toBeVisible({ timeout: 3000 })
  })

  test('checkbox selection and context menu interactions', async ({ page }) => {
    const expenseTable = page.getByTestId('expense-table')
    const rows = page.locator("[data-testid^='expense-row-']")
    const firstRow = rows.first()

    // Row checkbox toggles selection
    await expenseTable.getByRole('checkbox', { name: 'Select Snack' }).click({ force: true })
    await expect(firstRow).toHaveClass(/selected-row/)

    // Select all / deselect all
    const selectAllCheckbox = expenseTable.getByRole('checkbox', { name: 'Select all' })
    await selectAllCheckbox.click({ force: true })
    for (let i = 0; i < (await rows.count()); i++) {
      await expect(rows.nth(i)).toHaveClass(/selected-row/)
    }
    await selectAllCheckbox.click({ force: true })
    for (let i = 0; i < (await rows.count()); i++) {
      await expect(rows.nth(i)).not.toHaveClass(/selected-row/)
    }

    // Right-click shows context menu
    await firstRow.click({ button: 'right' })
    await expect(page.getByText('Edit')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('Copy')).toBeVisible()
    await expect(page.getByText('Delete')).toBeVisible()

    // Dismiss context menu
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // Multiple selection shows bulk context menu
    await expenseTable.getByRole('checkbox', { name: 'Select Snack' }).click({ force: true })
    await expenseTable.getByRole('checkbox', { name: 'Select Groceries' }).click({ force: true })
    await rows.nth(0).click({ button: 'right' })
    await expect(page.getByText(/Edit \d rows/)).toBeVisible({ timeout: 3000 })
    await expect(page.getByText(/Copy \d rows/)).toBeVisible()
    await expect(page.getByText(/Delete \d rows/)).toBeVisible()
  })
})
