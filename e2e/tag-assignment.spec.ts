import { test } from '@playwright/test'
import {
  addCategory,
  addTag,
  expect,
  getAllExpenses,
  getTagIdsForExpense,
  resetAppState,
} from './helpers'

test.describe('Tag assignment flows (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page)
  })

  test('assign existing tag on create and persist', async ({ page }) => {
    const categoryName = 'TagSpecCat'
    await addCategory(page, categoryName)
    const existingTagId = await addTag(page, 'Transit')

    await page.getByTestId('btn-add-expense').first().click()
    await expect(page.getByTestId('expense-form')).toBeVisible()
    await page.getByPlaceholder('Optional').fill('Bus ride')
    await page.getByTestId('desktop-category-dropdown').getByRole('button').click()
    await page.getByPlaceholder('Search...').fill(categoryName)
    await page.getByText(categoryName).click()
    await page.getByLabel('Amount').fill('6.25')
    await page.getByPlaceholder('Select tags').fill('Transit')
    await page.getByRole('option', { name: 'Transit' }).click()
    await page.getByTestId('btn-save-expense').click()

    await page.getByTestId('view-tab-expenses').first().click()
    await expect(page.getByTestId('expense-table')).toContainText('Transit')

    const created = (await getAllExpenses(page)).find((expense) => expense.notes === 'Bus ride')
    expect(created?.id).toBeTruthy()
    const tagIds = await getTagIdsForExpense(page, created?.id as number)
    expect(tagIds).toContain(existingTagId)
  })

  test('create a new tag from expense form and update tags on edit', async ({ page }) => {
    const categoryName = 'TagSpecCat'
    await addCategory(page, categoryName)
    await page.getByTestId('btn-add-expense').first().click()
    await page.getByPlaceholder('Optional').fill('Market stop')
    await page.getByTestId('desktop-category-dropdown').getByRole('button').click()
    await page.getByPlaceholder('Search...').fill(categoryName)
    await page.getByText(categoryName).click()
    await page.getByLabel('Amount').fill('24')
    await page.getByPlaceholder('Select tags').fill('Farmers Market')
    await page.getByRole('option', { name: 'Create "Farmers Market"' }).click()
    await page.getByTestId('btn-save-expense').click()

    await page.getByTestId('view-tab-expenses').first().click()
    const row = page.locator("[data-testid^='expense-row-']").filter({ hasText: 'Market stop' }).first()
    await row.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const editDialog = page.getByRole('dialog', { name: 'Edit Expense' })
    await expect(editDialog).toBeVisible()

    await editDialog.getByLabel('Remove tag Farmers Market').click()
    const tagInput = editDialog.getByPlaceholder('Select tags')
    await tagInput.fill('Essentials')
    await editDialog.getByRole('option', { name: 'Create "Essentials"' }).click()
    await editDialog.getByTestId('btn-save-expense').click()

    await expect(page.getByTestId('expense-table')).toContainText('Essentials')
    await expect(page.getByTestId('expense-table')).not.toContainText('Farmers Market')
  })

  test('inline dashboard tag editing: add existing tag', async ({ page }) => {
    const categoryName = 'TagSpecCat'
    await addCategory(page, categoryName)
    const existingTagId = await addTag(page, 'Recurring')
    await page.getByTestId('btn-add-expense').first().click()
    await page.getByPlaceholder('Optional').fill('Internet')
    await page.getByTestId('desktop-category-dropdown').getByRole('button').click()
    await page.getByPlaceholder('Search...').fill(categoryName)
    await page.getByText(categoryName).click()
    await page.getByLabel('Amount').fill('59.99')
    await page.getByTestId('btn-save-expense').click()

    await page.getByTestId('view-tab-expenses').first().click()
    const row = page.locator("[data-testid^='expense-row-']").filter({ hasText: 'Internet' }).first()
    const tagsCell = row.locator('[data-field="tags"]')
    await tagsCell.click()
    const popover = page.getByTestId('tags-editor-popover')
    await expect(popover).toBeVisible()
    await popover.getByPlaceholder('Search or create tags').fill('Recurring')
    await popover.getByRole('option', { name: 'Recurring' }).click()
    await popover.getByTestId('tags-editor-save').click()
    await expect(row).toContainText('Recurring')
    const internet = (await getAllExpenses(page)).find((expense) => expense.notes === 'Internet')
    const updatedTagIds = await getTagIdsForExpense(page, internet?.id as number)
    expect(updatedTagIds).toContain(existingTagId)
  })

  test('inline dashboard tag editing: create new tag', async ({ page }) => {
    const categoryName = 'TagSpecCat'
    await addCategory(page, categoryName)
    await page.getByTestId('btn-add-expense').first().click()
    await page.getByPlaceholder('Optional').fill('Rent')
    await page.getByTestId('desktop-category-dropdown').getByRole('button').click()
    await page.getByPlaceholder('Search...').fill(categoryName)
    await page.getByText(categoryName).click()
    await page.getByLabel('Amount').fill('1200')
    await page.getByTestId('btn-save-expense').click()

    await page.getByTestId('view-tab-expenses').first().click()
    const row = page.locator("[data-testid^='expense-row-']").filter({ hasText: 'Rent' }).first()
    const tagsCell = row.locator('[data-field="tags"]')
    await tagsCell.click()
    const popover = page.getByTestId('tags-editor-popover')
    await expect(popover).toBeVisible()
    await popover.getByPlaceholder('Search or create tags').fill('Home')
    await popover.getByRole('option', { name: 'Create "Home"' }).click()
    await popover.getByTestId('tags-editor-save').click()
    await expect(row).toContainText('Home')
  })

  test('inline dashboard tag editing: remove all tags', async ({ page }) => {
    const categoryName = 'TagSpecCat'
    await addCategory(page, categoryName)
    const recurringId = await addTag(page, 'Recurring')
    await page.getByTestId('btn-add-expense').first().click()
    await page.getByPlaceholder('Optional').fill('Phone')
    await page.getByTestId('desktop-category-dropdown').getByRole('button').click()
    await page.getByPlaceholder('Search...').fill(categoryName)
    await page.getByText(categoryName).click()
    await page.getByLabel('Amount').fill('45')
    await page.getByPlaceholder('Select tags').fill('Recurring')
    await page.getByRole('option', { name: 'Recurring' }).click()
    await page.getByTestId('btn-save-expense').click()

    await page.getByTestId('view-tab-expenses').first().click()
    const row = page.locator("[data-testid^='expense-row-']").filter({ hasText: 'Phone' }).first()
    const tagsCell = row.locator('[data-field="tags"]')
    await tagsCell.click()
    const popover = page.getByTestId('tags-editor-popover')
    await expect(popover).toBeVisible()
    await popover.getByLabel('Remove tag Recurring').click()
    await popover.getByTestId('tags-editor-save').click()
    await expect(row).not.toContainText('Recurring')

    const phone = (await getAllExpenses(page)).find((expense) => expense.notes === 'Phone')
    const updatedTagIds = await getTagIdsForExpense(page, phone?.id as number)
    expect(updatedTagIds).not.toContain(recurringId)
    expect(updatedTagIds).toHaveLength(0)
  })
})
