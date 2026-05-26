import { test } from '@playwright/test'
import {
  addTag,
  expect,
  getAllExpenses,
  getTagIdsForExpense,
  getTags,
  resetAppState,
  setExpenseTags,
} from './helpers'

test.describe('Tag management (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, { route: '/tags' })
    await expect(page.getByTestId('tags-page')).toBeVisible()
  })

  test('create, search, inline edit with persistence', async ({ page }) => {
    await page.getByPlaceholder('New tag name').fill('Coffee')
    await page.getByTestId('btn-add-tag').click()
    await expect(page.getByText('Coffee')).toBeVisible()

    await page.getByPlaceholder('Search tags...').fill('cof')
    await expect(page.getByText('Coffee')).toBeVisible()
    await page.getByPlaceholder('Search tags...').fill('')

    const coffeeRow = page.locator("[data-testid^='tag-row-']").filter({ hasText: 'Coffee' })
    await coffeeRow.getByRole('button', { name: 'Edit' }).click()
    const editInput = page.locator("[data-testid^='tag-row-'] input[type='text']").first()
    await expect(editInput).toBeVisible()
    await editInput.fill('Coffee Beans')
    await editInput.press('Enter')
    await expect(page.getByText('Coffee Beans')).toBeVisible()

    await page.goto('/settings')
    await page.goto('/tags')
    await expect(page.getByText('Coffee Beans')).toBeVisible()
  })

  test('archive delete + undo keeps links intact', async ({ page }) => {
    await resetAppState(page, {
      route: '/tags',
      expenses: [{ date: '2026-05-10', amount: 18, notes: 'Tagged lunch' }],
    })
    const lunchTagId = await addTag(page, 'LunchTag')
    const taggedExpenseId = (await getAllExpenses(page)).find((expense) => expense.notes === 'Tagged lunch')
      ?.id as number
    await setExpenseTags(page, taggedExpenseId, [lunchTagId])
    expect(await getTagIdsForExpense(page, taggedExpenseId)).toContain(lunchTagId)

    await page.goto('/tags')
    const lunchRow = page.locator("[data-testid^='tag-row-']").filter({ hasText: 'LunchTag' })
    await lunchRow.getByRole('button', { name: 'Delete' }).click()
    await page
      .getByRole('dialog', { name: 'Delete tag' })
      .getByRole('button', { name: 'Delete', exact: true })
      .click()
    await expect(page.getByText('LunchTag')).toHaveCount(0)

    await page.getByRole('button', { name: 'Undo' }).click()
    expect(await getTagIdsForExpense(page, taggedExpenseId)).toContain(lunchTagId)
  })

  test('unlink-all-and-archive + undo', async ({ page }) => {
    await resetAppState(page, {
      route: '/tags',
      expenses: [{ date: '2026-05-10', amount: 50, notes: 'Utilities bill' }],
    })
    const utilitiesTagId = await addTag(page, 'Utilities')
    const utilitiesExpenseId = (await getAllExpenses(page)).find((expense) => expense.notes === 'Utilities bill')
      ?.id as number
    await setExpenseTags(page, utilitiesExpenseId, [utilitiesTagId])
    expect(await getTagIdsForExpense(page, utilitiesExpenseId)).toContain(utilitiesTagId)

    await page.goto('/tags')
    const row = page.locator("[data-testid^='tag-row-']").filter({ hasText: 'Utilities' })
    await row.getByRole('button', { name: 'Delete' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete tag' })
    await dialog.getByRole('button', { name: 'Unlink all and delete' }).click()
    await expect(page.getByText('Utilities')).toHaveCount(0)
    expect(await getTagIdsForExpense(page, utilitiesExpenseId)).toHaveLength(0)

    await page.getByRole('button', { name: 'Undo' }).click()
    expect(await getTagIdsForExpense(page, utilitiesExpenseId)).toContain(utilitiesTagId)
  })

  test('merge + undo', async ({ page }) => {
    await addTag(page, 'Groceries')
    await addTag(page, 'Food')
    await page.goto('/tags')

    const groceryTag = (await getTags(page)).find((tag) => tag.name === 'Groceries')
    expect(groceryTag?.id).toBeTruthy()
    const sourceRow = page.getByTestId(`tag-row-${groceryTag?.id as number}`)
    await sourceRow.getByRole('button', { name: 'Merge' }).click()
    const mergeDialog = page.getByRole('dialog', { name: 'Merge Tag' })
    await mergeDialog.locator('select').selectOption({ label: 'Food' })
    await mergeDialog.getByRole('button', { name: 'Merge Tag' }).click()

    await expect(page.getByTestId(`tag-row-${groceryTag?.id as number}`)).toHaveCount(0)
    const foodTag = (await getTags(page)).find((tag) => tag.name === 'Food')
    expect(foodTag?.id).toBeTruthy()
    await expect(page.getByTestId(`tag-row-${foodTag?.id as number}`)).toBeVisible()

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByTestId(`tag-row-${groceryTag?.id as number}`)).toBeVisible()

    const tags = await getTags(page)
    expect(tags.some((tag) => tag.name === 'Groceries' && !tag.isArchived)).toBe(true)
    expect(tags.some((tag) => tag.name === 'Food' && !tag.isArchived)).toBe(true)
  })
})
