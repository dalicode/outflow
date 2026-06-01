import { test, expect } from '@playwright/test'
import { getMonthOffsetIsoDate, getMonthOffsetLabel, resetAppState } from './helpers'

test.describe('Date picker dropdown (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [{ date: getMonthOffsetIsoDate(1), amount: 15.5, notes: 'Calendar test' }],
      settings: { dateFormat: 'MM/DD/YYYY' },
    })

    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('expense-table')).toBeVisible()
  })

  test('calendar day clicks from next and previous month update the input value', async ({
    page,
  }) => {
    const formatInputDate = (isoDate: string): string => {
      const [year, month, day] = isoDate.split('-')
      return `${month}/${day}/${year}`
    }
    const formatAriaDate = (monthOffset: number, day: number): string =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, day))

    const currentMonthFirstDay = getMonthOffsetIsoDate(1)
    const currentMonthFifthDay = getMonthOffsetIsoDate(5)
    const nextMonthTenthDay = getMonthOffsetIsoDate(10, 1)
    const currentMonthLabel = getMonthOffsetLabel(0)
    const nextMonthLabel = getMonthOffsetLabel(1)
    const firstRow = page.locator("[data-testid^='expense-row-']").first()
    await firstRow.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    const dialog = page.getByRole('dialog', { name: 'Edit Expense' })
    await expect(dialog).toBeVisible()

    const dateInput = dialog.locator('input[placeholder^="Select date"]').first()
    await expect(dateInput).toHaveValue(formatInputDate(currentMonthFirstDay))

    await dateInput.click()
    let calendar = page.getByTestId('date-picker-popover')
    await expect(calendar.getByText(currentMonthLabel)).toBeVisible()
    await calendar.getByRole('button', { name: 'Next month' }).click()
    await expect(calendar.getByText(nextMonthLabel)).toBeVisible()
    await calendar.getByRole('button', { name: formatAriaDate(1, 10) }).click()
    await expect(dateInput).toHaveValue(formatInputDate(nextMonthTenthDay))

    await dateInput.click()
    calendar = page.getByTestId('date-picker-popover')
    await expect(calendar.getByText(nextMonthLabel)).toBeVisible()
    await calendar.getByRole('button', { name: 'Previous month' }).click()
    await expect(calendar.getByText(currentMonthLabel)).toBeVisible()
    await calendar.getByRole('button', { name: formatAriaDate(0, 5) }).click()
    await expect(dateInput).toHaveValue(formatInputDate(currentMonthFifthDay))
  })
})
