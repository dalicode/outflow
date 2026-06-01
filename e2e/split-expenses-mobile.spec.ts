import { test, type Page } from '@playwright/test'
import {
  addCategory,
  addPayee,
  expect,
  getMonthOffsetIsoDate,
  resetAppState,
  seedExpenseSplit,
} from './helpers'

test.describe('Split expenses (mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page)
  })

  async function seedMobileSplit(page: Page): Promise<void> {
    const foodCategory = await addCategory(page, 'Split Mobile Food E2E')
    const travelCategory = await addCategory(page, 'Split Mobile Travel E2E')
    const payeeId = await addPayee(page, 'Mobile Split Payee')

    await seedExpenseSplit(page, {
      split: {
        date: getMonthOffsetIsoDate(22),
        amount: 64,
        payeeId,
        payeeNameSnapshot: 'Mobile Split Payee',
        notes: 'Mobile trip split',
      },
      children: [
        { categoryId: foodCategory, amount: 24, notes: 'Breakfast' },
        { categoryId: travelCategory, amount: 40, notes: 'Transit' },
      ],
    })

    await page.goto('/')
    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('expense-table')).toBeVisible({ timeout: 10000 })
  }

  test('supports split expand and edit entry on mobile', async ({ page }) => {
    await seedMobileSplit(page)

    const splitParentCard = page.locator("[data-testid^='split-container-mobile-']").first()
    await expect(splitParentCard).toBeVisible()
    await expect(splitParentCard).toContainText('Mobile Split Payee')
    await expect(splitParentCard).toContainText('Mobile trip split')
    await expect(splitParentCard).toContainText('$64.00')

    const splitChildren = page.locator("[data-testid^='expense-row-mobile-']")
    await expect(splitChildren).toHaveCount(0)

    await splitParentCard.getByRole('button', { name: /Split/ }).click()
    await expect(splitChildren).toHaveCount(2)
    await expect(splitChildren.filter({ hasText: 'Breakfast' })).toHaveCount(1)
    await expect(splitChildren.filter({ hasText: '$24.00' })).toHaveCount(1)
    await expect(splitChildren.filter({ hasText: 'Transit' })).toHaveCount(1)
    await expect(splitChildren.filter({ hasText: '$40.00' })).toHaveCount(1)

    await splitParentCard.click()
    const form = page.getByTestId('expense-form')
    await expect(form).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Enable split transaction' })).toBeChecked()
    await expect(page.getByLabel('Split amount 1')).toHaveValue('$24.00')
    await expect(page.getByLabel('Split amount 2')).toHaveValue('$40.00')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(form).not.toBeVisible({ timeout: 10000 })
  })
})
