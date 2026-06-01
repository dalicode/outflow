import { test, expect, type Page } from '@playwright/test'
import { resetAppState, waitForAppReady } from './helpers'

const visibleFiltersButton = (page: Page) =>
  page.getByTestId('btn-open-filters').filter({ visible: true }).first()

test.describe('Date picker dropdown (mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-05-15T12:00:00') })
    await resetAppState(page, {
      settings: { dateFormat: 'MM/DD/YYYY' },
    })
  })

  test('bottom-sheet day clicks update the trigger value', async ({ page }) => {
    await waitForAppReady(page)
    await expect(visibleFiltersButton(page)).toBeVisible()
    await visibleFiltersButton(page).click()
    const dialog = page.getByRole('dialog', { name: 'Filter Transactions' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'From' }).click()
    let calendar = page.getByTestId('date-picker-popover')
    await expect(calendar.getByText('May 2026')).toBeVisible()
    await calendar.getByRole('button', { name: 'Next month' }).click()
    await expect(calendar.getByText('Jun 2026')).toBeVisible()
    await calendar.getByRole('button', { name: 'Jun 10, 2026' }).click()
    await expect(dialog.getByRole('button', { name: '06/10/2026' })).toBeVisible()

    await dialog.getByRole('button', { name: 'To' }).click()
    calendar = page.getByTestId('date-picker-popover')
    await expect(calendar.getByText('May 2026')).toBeVisible()
    await calendar.getByRole('button', { name: 'Previous month' }).click()
    await expect(calendar.getByText('Apr 2026')).toBeVisible()
    await calendar.getByRole('button', { name: 'Apr 9, 2026' }).click()
    await expect(dialog.getByRole('button', { name: '04/09/2026' })).toBeVisible()
  })
})
