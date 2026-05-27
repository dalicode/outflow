import { test } from '@playwright/test'
import {
  clearAllData,
  expect,
  getAllExpenses,
  gotoAndWait,
  inspectFakeCloudExpenses,
  resetFakeCloud,
  setFakeSignedInUser,
  triggerManualSync,
} from './helpers'

test.describe('Cross-device expense sync repro', () => {
  test('expense created on device A should appear on device B after manual sync', async ({
    browser,
  }) => {
    const userId = 'fake-user:sync-repro@example.com'
    const email = 'sync-repro@example.com'

    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    try {
      await gotoAndWait(pageA, '/')
      await gotoAndWait(pageB, '/')

      await clearAllData(pageA)
      await clearAllData(pageB)
      await resetFakeCloud(pageA)

      await setFakeSignedInUser(pageA, userId, email)

      await pageA.getByTestId('btn-add-expense').first().click()
      await expect(pageA.getByTestId('expense-form')).toBeVisible()
      await pageA.getByPlaceholder('Optional').fill('Cross-device sync repro expense')

      const categoryDropdown = pageA.getByTestId('desktop-category-dropdown')
      await categoryDropdown.getByRole('button').click()
      await pageA.getByPlaceholder('Search...').fill('Food')
      await pageA.getByText('Food').click()

      const amountInput = pageA.locator('[aria-label="Amount"]')
      await amountInput.click()
      await amountInput.fill('42.10')
      await pageA.getByTestId('btn-save-expense').click()
      await expect(pageA.getByTestId('expense-form')).not.toBeVisible({ timeout: 5000 })

      await triggerManualSync(pageA)

      await expect
        .poll(async () =>
          (await inspectFakeCloudExpenses(pageA, userId)).some(
            (row) => row.notes === 'Cross-device sync repro expense',
          ),
        )
        .toBe(true)

      await setFakeSignedInUser(pageB, userId, email)
      const preSyncDeviceBExpenses = await getAllExpenses(pageB)
      expect(
        preSyncDeviceBExpenses.some((row) => row.notes === 'Cross-device sync repro expense'),
      ).toBe(false)

      await triggerManualSync(pageB)
      await gotoAndWait(pageB, '/')
      await pageB.getByTestId('view-tab-expenses').first().click()
      await expect(pageB.getByTestId('expense-table')).toBeVisible({ timeout: 5000 })
      await expect(pageB.getByText('Cross-device sync repro expense')).toBeVisible({
        timeout: 5000,
      })

      const deviceBExpenses = await getAllExpenses(pageB)
      expect(deviceBExpenses.some((row) => row.notes === 'Cross-device sync repro expense')).toBe(
        true,
      )
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})
