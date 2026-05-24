import { test, expect } from '@playwright/test'
import { resetAppState } from './helpers'

test.describe('Expense deletion flows (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: '2026-05-01', amount: 15.5, description: 'Lunch' },
        { date: '2026-05-02', amount: 42.0, description: 'Groceries' },
        { date: '2026-05-03', amount: 5.0, description: 'Snack' },
      ],
    })

    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('expense-table')).toBeVisible()
  })

  test('single and bulk delete with undo', async ({ page }) => {
    const rows = page.locator("[data-testid^='expense-row-']")

    // ── Single delete ──
    await rows.first().click({ button: 'right' })
    await page.getByText('Delete').click()

    const confirmDialog = page.getByRole('dialog', { name: 'Confirm Delete' })
    await expect(confirmDialog).toBeVisible()
    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(rows).toHaveCount(2)
    await expect(page.getByText('Deleted Snack.')).toBeVisible()

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(rows).toHaveCount(3)
    await expect(page.getByText('Lunch')).toBeVisible()

    // ── Bulk delete ──
    await rows.nth(0).locator('.expense-checkbox-wrapper').first().click({ force: true })
    await rows.nth(1).locator('.expense-checkbox-wrapper').first().click({ force: true })

    await rows.nth(0).click({ button: 'right' })
    await page.getByText('Delete 2 rows').click()

    await expect(confirmDialog).toBeVisible()
    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(rows).toHaveCount(1)
    await expect(page.getByText('Deleted 2 expenses.')).toBeVisible()

    await page.getByRole('button', { name: 'Undo' }).click()

    await expect(rows).toHaveCount(3)
    await expect(page.getByText('Lunch')).toBeVisible()
    await expect(page.getByText('Groceries')).toBeVisible()
  })
})
