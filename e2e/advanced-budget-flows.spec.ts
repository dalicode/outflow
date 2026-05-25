import { test } from '@playwright/test'
import { addPayee, expect, getAllExpenses, getPayees, resetAppState, seedExpenses } from './helpers'

test.describe('Advanced budget flows', () => {
  test('bulk edit applies notes updates to selected expenses', async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: '2026-05-01', amount: 15.5, notes: 'Lunch' },
        { date: '2026-05-02', amount: 42.0, notes: 'Groceries' },
        { date: '2026-05-03', amount: 5.0, notes: 'Snack' },
      ],
    })

    await page.getByTestId('view-tab-expenses').first().click()
    const rows = page.locator("[data-testid^='expense-row-']")

    await rows.nth(0).locator('.expense-checkbox-wrapper').first().click({ force: true })
    await rows.nth(1).locator('.expense-checkbox-wrapper').first().click({ force: true })

    await rows.nth(0).click({ button: 'right' })
    await page.getByText('Edit 2 rows').click()

    const dialog = page.getByRole('dialog', { name: 'Edit 2 Expenses' })
    await expect(dialog).toBeVisible()
    await dialog.locator('label', { hasText: 'Notes' }).click()
    await dialog.getByPlaceholder('Enter notes...').fill('Shared notes')
    await dialog.getByRole('button', { name: 'Apply Changes' }).click()

    await expect(dialog).not.toBeVisible()
    await expect(rows.nth(0).locator("[data-field='notes']")).toHaveText('Shared notes')
    await expect(rows.nth(1).locator("[data-field='notes']")).toHaveText('Shared notes')
    await expect(rows.nth(2).locator("[data-field='notes']")).toHaveText('Lunch')
  })

  test('merging payees reassigns expenses and archives the source payee', async ({ page }) => {
    await resetAppState(page)
    const alphaId = await addPayee(page, 'Alpha Market')
    const betaId = await addPayee(page, 'Beta Market')

    await seedExpenses(page, [
      {
        date: '2026-05-04',
        amount: 24.75,
        notes: 'Alpha lunch',
        payeeId: alphaId,
      },
      {
        date: '2026-05-05',
        amount: 18.2,
        notes: 'Alpha coffee',
        payeeId: alphaId,
      },
    ])

    await page.goto('/payees')
    await expect(page.getByTestId('payees-page')).toBeVisible()

    const alphaRow = page.locator("[data-testid^='payee-row-']").filter({
      has: page.getByText('Alpha Market', { exact: false }),
    })
    await alphaRow.getByText('Merge').click()

    const mergeDialog = page.getByRole('dialog', { name: 'Merge Payee' })
    await expect(mergeDialog).toBeVisible()
    await mergeDialog.locator('select').selectOption(String(betaId))
    await mergeDialog.getByRole('button', { name: 'Merge Payee' }).click()
    await expect(mergeDialog).not.toBeVisible()

    // Wait for the toast to appear and disappear, then verify no payee row exists
    await page.waitForTimeout(5500)
    await expect(
      page.locator("[data-testid^='payee-row-']").filter({
        has: page.getByText('Alpha Market'),
      }),
    ).toHaveCount(0)

    const payees = await getPayees(page)
    const alpha = payees.find((payee) => payee.id === alphaId)
    expect(alpha?.isArchived).toBe(true)
    expect(alpha?.mergedIntoPayeeId).toBe(betaId)

    const expenses = await getAllExpenses(page)
    const alphaExpenses = expenses.filter((expense) =>
      ['Alpha lunch', 'Alpha coffee'].includes(expense.notes ?? ''),
    ) as Array<{ payeeId?: number }>
    expect(alphaExpenses.every((expense) => expense.payeeId === betaId)).toBe(true)
  })
})
