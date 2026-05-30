import { test, expect } from '@playwright/test'
import { resetAppState } from './helpers'

test.describe('Date picker dropdown (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [{ date: '2026-05-01', amount: 15.5, notes: 'Calendar test' }],
      settings: { dateFormat: 'MM/DD/YYYY' },
    })

    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('expense-table')).toBeVisible()
  })

  test('calendar day clicks from next and previous month update the input value', async ({
    page,
  }) => {
    const firstRow = page.locator("[data-testid^='expense-row-']").first()
    await firstRow.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    const dialog = page.getByRole('dialog', { name: 'Edit Expense' })
    await expect(dialog).toBeVisible()

    const dateInput = dialog.locator('input[placeholder^="Select date"]').first()
    await expect(dateInput).toHaveValue('05/01/2026')

    await dateInput.click()
    let calendar = page.getByTestId('date-picker-popover')
    await expect(calendar.getByText('May 2026')).toBeVisible()
    await calendar.getByRole('button', { name: 'Next month' }).click()
    await expect(calendar.getByText('Jun 2026')).toBeVisible()
    await calendar.getByRole('button', { name: 'Jun 10, 2026' }).click()
    await expect(dateInput).toHaveValue('06/10/2026')

    await dateInput.click()
    calendar = page.getByTestId('date-picker-popover')
    await expect(calendar.getByText('Jun 2026')).toBeVisible()
    await calendar.getByRole('button', { name: 'Previous month' }).click()
    await expect(calendar.getByText('May 2026')).toBeVisible()
    await calendar.getByRole('button', { name: 'May 5, 2026' }).click()
    await expect(dateInput).toHaveValue('05/05/2026')
  })
})
