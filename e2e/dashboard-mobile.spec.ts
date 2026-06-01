import { test, expect } from '@playwright/test'
import {
  getMonthOffsetIsoDate,
  longPressElement,
  openMobileSecondaryNav,
  resetAppState,
} from './helpers'

test.describe('Dashboard — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page)
  })

  test('mobile nav renders with add expense button and view tabs', async ({ page }) => {
    await expect(
      page
        .getByTestId('btn-add-expense')
        .filter({ has: page.locator(':visible') })
        .first(),
    ).toBeVisible()
    await expect(page.getByTestId('view-tab-categories')).toBeVisible()

    await page.getByTestId('view-tab-payees').first().click()
    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('view-tab-expenses').first()).toHaveClass(/bg-theme-surface/)
  })

  test('open filter modal', async ({ page }) => {
    await page.getByTestId('btn-open-filters').first().click()
    await expect(page.getByRole('dialog', { name: 'Filter Transactions' })).toBeVisible()
  })

  test('expanded second-row nav icons respond immediately', async ({ page }) => {
    await openMobileSecondaryNav(page)
    const settingsLink = page.locator('.mobile-nav-row-secondary').getByTestId('nav-settings')
    await settingsLink.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('expenses view shows seeded mobile rows', async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: getMonthOffsetIsoDate(1), amount: 10.0, notes: 'Coffee' },
        { date: getMonthOffsetIsoDate(2), amount: 25.0, notes: 'Lunch' },
        { date: getMonthOffsetIsoDate(3), amount: 5.0, notes: 'Snack' },
      ],
    })

    await page.getByTestId('view-tab-expenses').first().click()
    const expenseRows = page.locator("[data-testid^='expense-row-mobile-']")
    await expect(expenseRows).toHaveCount(3)
  })

  test('bulk delete from the mobile selection banner can be undone', async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: getMonthOffsetIsoDate(1), amount: 10.0, notes: 'Coffee' },
        { date: getMonthOffsetIsoDate(2), amount: 25.0, notes: 'Lunch' },
        { date: getMonthOffsetIsoDate(3), amount: 5.0, notes: 'Snack' },
      ],
    })

    await page.getByTestId('view-tab-expenses').first().click()
    await longPressElement(page, "[data-testid^='expense-row-mobile-']")

    const banner = page.getByTestId('selection-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('1 selected')

    await page.locator("[data-testid^='expense-row-mobile-']").nth(1).click()
    await expect(banner).toContainText('2 selected')

    await page.getByTestId('btn-selection-menu').click()
    await page.getByTestId('btn-delete-selection').click()

    const confirmDialog = page.getByRole('dialog', { name: 'Confirm Delete' })
    await expect(confirmDialog).toBeVisible()
    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    const expenseRows = page.locator("[data-testid^='expense-row-mobile-']")
    await expect(expenseRows).toHaveCount(1)
    await expect(page.getByText('Deleted 2 expenses.')).toBeVisible()

    await page.getByRole('button', { name: 'Undo' }).click()

    await expect(expenseRows).toHaveCount(3)
    await expect(expenseRows.filter({ hasText: 'Coffee' })).toHaveCount(1)
    await expect(expenseRows.filter({ hasText: 'Lunch' })).toHaveCount(1)
  })
})
