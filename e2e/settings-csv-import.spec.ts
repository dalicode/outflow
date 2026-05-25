import { test } from '@playwright/test'
import { expect, getAllExpenses, resetAppState } from './helpers'

const CSV_IMPORT_SAMPLE = [
  'date,amount,category,description',
  '2026-04-03,12.45,Food,Coffee shop',
  '2026-04-08,84.10,Transportation,Train pass',
].join('\n')

test.describe('Settings CSV import', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, { route: '/settings' })
  })

  test('imports csv rows through review and shows the historical completion prompt', async ({
    page,
  }) => {
    await page.locator("input[type='file'][accept='.csv']").setInputFiles({
      name: 'transactions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CSV_IMPORT_SAMPLE, 'utf-8'),
    })

    const reviewDialog = page.getByRole('dialog', { name: 'Review Import' })
    await expect(reviewDialog).toBeVisible()
    await expect(reviewDialog.getByText('Rows found')).toBeVisible()

    await reviewDialog.getByTestId('btn-import-confirm').click()

    await expect(page.getByRole('dialog', { name: 'Complete Imported Months' })).toBeVisible()
    await expect(page.getByText(/transactions were imported successfully/i)).toBeVisible()

    const expenses = await getAllExpenses(page)
    expect(expenses).toHaveLength(2)
    expect(expenses.map((expense) => expense.notes)).toEqual(
      expect.arrayContaining(['Coffee shop', 'Train pass']),
    )
  })
})
