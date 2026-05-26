import { test, expect } from '@playwright/test'
import { addTag, getAllExpenses, getTagIdsForExpense, resetAppState, setExpenseTags } from './helpers'

test.describe('Filter modal (desktop)', () => {
  const visibleFiltersButton = (page: import('@playwright/test').Page) =>
    page.getByTestId('btn-open-filters').filter({ visible: true }).first()

  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: '2026-05-01', amount: 15.5, notes: 'Lunch' },
        { date: '2026-05-02', amount: 42.0, notes: 'Groceries' },
      ],
    })
  })

  test('filter modal opens, closes, and reset works', async ({ page }) => {
    await visibleFiltersButton(page).click()
    await expect(page.getByRole('dialog', { name: 'Filter Transactions' })).toBeVisible()

    const searchInput = page.getByPlaceholder('Notes, category, payee, tag, or amount...')
    await searchInput.fill('test query')
    await expect(searchInput).toHaveValue('test query')

    await page.getByTestId('btn-clear-all-filters').click()
    await expect(searchInput).toHaveValue('')

    await page.getByTestId('btn-apply-filters').click()
    await expect(page.getByRole('dialog', { name: 'Filter Transactions' })).not.toBeVisible({
      timeout: 5000,
    })
  })

  test('filter by global search text shows active count', async ({ page }) => {
    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('expense-table')).toBeVisible({ timeout: 5000 })

    await visibleFiltersButton(page).click()
    await expect(page.getByRole('dialog', { name: 'Filter Transactions' })).toBeVisible()

    const searchInput = page.getByPlaceholder('Notes, category, payee, tag, or amount...')
    await searchInput.fill('Lunch')

    await page.getByTestId('btn-apply-filters').click()
    await expect(page.getByRole('dialog', { name: 'Filter Transactions' })).not.toBeVisible({
      timeout: 5000,
    })

    const expenseTable = page.getByTestId('expense-table')
    await expect(expenseTable.getByText('Lunch')).toBeVisible()
    await expect(expenseTable.getByText('Groceries')).toHaveCount(0)

    const filterButton = visibleFiltersButton(page)
    await expect(filterButton).toBeVisible()
    await expect(filterButton).toContainText('1')
  })

  test('filter by tag from modal + clear filters reset', async ({ page }) => {
    const groceriesTagId = await addTag(page, 'Groceries')
    const fuelTagId = await addTag(page, 'Fuel')
    const expenses = await getAllExpenses(page)
    const lunchId = expenses.find((expense) => expense.notes === 'Lunch')?.id
    const groceriesId = expenses.find((expense) => expense.notes === 'Groceries')?.id
    expect(lunchId).toBeTruthy()
    expect(groceriesId).toBeTruthy()

    await setExpenseTags(page, lunchId as number, [fuelTagId])
    await setExpenseTags(page, groceriesId as number, [groceriesTagId])

    await page.reload()
    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('expense-table')).toBeVisible({ timeout: 5000 })

    await visibleFiltersButton(page).click()
    await page.getByRole('button', { name: 'Select tags' }).click()
    await page.getByRole('button', { name: 'Groceries' }).click()
    await page.getByTestId('btn-apply-filters').click()

    const table = page.getByTestId('expense-table')
    await expect(table.locator("[data-testid^='expense-row-']")).toHaveCount(1)
    await expect(table.getByText('Lunch')).toHaveCount(0)

    await visibleFiltersButton(page).click()
    await page.getByTestId('btn-clear-all-filters').click()
    await page.getByTestId('btn-apply-filters').click()
    await expect(table.locator("[data-testid^='expense-row-']")).toHaveCount(2)
  })

  test('global search matches tag names', async ({ page }) => {
    const diningTagId = await addTag(page, 'Dining')
    const fuelTagId = await addTag(page, 'Fuel')
    const expenses = await getAllExpenses(page)
    const lunchId = expenses.find((expense) => expense.notes === 'Lunch')?.id
    const groceriesId = expenses.find((expense) => expense.notes === 'Groceries')?.id
    expect(lunchId).toBeTruthy()
    expect(groceriesId).toBeTruthy()

    await setExpenseTags(page, lunchId as number, [diningTagId])
    await setExpenseTags(page, groceriesId as number, [fuelTagId])

    const lunchTagIds = await getTagIdsForExpense(page, lunchId as number)
    expect(lunchTagIds).toContain(diningTagId)

    await page.reload()
    await page.getByTestId('view-tab-expenses').first().click()
    await visibleFiltersButton(page).click()
    const searchInput = page.getByPlaceholder('Notes, category, payee, tag, or amount...')
    await searchInput.fill('Dining')
    await page.getByTestId('btn-apply-filters').click()

    const table = page.getByTestId('expense-table')
    await expect(table.getByText('Lunch')).toBeVisible()
    await expect(table.getByText('Groceries')).toHaveCount(0)
  })
})
