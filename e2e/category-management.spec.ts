import { test, type Page } from '@playwright/test'
import { expect, resetAppState } from './helpers'

async function openManageCategories(page: Page): Promise<void> {
  await page.getByTestId('btn-add-expense').first().click()
  await expect(page.getByTestId('expense-form')).toBeVisible()
  await page.getByRole('button', { name: '+ Manage' }).nth(1).click()
  await expect(page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible({
    timeout: 5000,
  })
}

async function addCategoryThroughModal(page: Page, name: string): Promise<void> {
  const newCatInput = page.getByPlaceholder('New category…')
  await newCatInput.click()
  await newCatInput.fill(name)
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByText(name, { exact: true })).toBeVisible()
}

test.describe('Category management (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page)
  })

  test('add a new category from the expense form', async ({ page }) => {
    await openManageCategories(page)
    await addCategoryThroughModal(page, 'Test Category')

    await page.getByRole('button', { name: 'Done' }).first().click()
    await expect(page.getByRole('heading', { name: 'Manage Categories' })).not.toBeVisible({
      timeout: 3000,
    })

    const categoryDropdown = page.getByTestId('desktop-category-dropdown')
    await categoryDropdown.getByRole('button').click()
    await page.getByPlaceholder('Search...').fill('Test Category')
    await expect(page.getByText('Test Category', { exact: true })).toBeVisible()
  })

  test('edit an existing category name', async ({ page }) => {
    await openManageCategories(page)
    await addCategoryThroughModal(page, 'TestCategory')

    await page.getByPlaceholder('Search categories...').fill('TestCategory')

    const catRow = page.locator("[data-testid^='category-row-']").filter({
      has: page.getByText('TestCategory', { exact: true }),
    })
    await catRow.getByRole('button', { name: 'Edit' }).click()

    const editingRow = page
      .locator("[data-testid^='category-row-']")
      .filter({ has: page.locator('input') })
      .first()
    const editInput = editingRow.locator('input').first()
    await expect(editInput).toBeVisible({ timeout: 3000 })
    await editInput.fill('RenamedCategory')

    await editingRow.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator("[data-testid^='category-row-'] input")).toHaveCount(0)
    await page.getByPlaceholder('Search categories...').fill('')
    await expect(
      page.locator("[data-testid^='category-row-']").filter({
        has: page.getByText('RenamedCategory', { exact: true }),
      }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).first().click()

    const categoryDropdown = page.getByTestId('desktop-category-dropdown')
    await categoryDropdown.getByRole('button').click()
    await page.getByPlaceholder('Search...').fill('RenamedCategory')
    await expect(page.getByText('RenamedCategory', { exact: true })).toBeVisible()
  })

  test('archive category and undo from manage categories', async ({ page }) => {
    await openManageCategories(page)
    await addCategoryThroughModal(page, 'UndoCategory')

    await page.getByPlaceholder('Search categories...').fill('UndoCategory')
    const catRow = page.locator("[data-testid^='category-row-']").filter({
      has: page.getByText('UndoCategory', { exact: true }),
    })
    await catRow.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { name: 'Delete category' })).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).last().click()

    await expect(catRow).not.toBeVisible({ timeout: 3000 })
    await expect(page.getByText('UndoCategory archived.')).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(catRow).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: 'Done' }).first().click()
    const categoryDropdown = page.getByTestId('desktop-category-dropdown')
    await categoryDropdown.getByRole('button').click()
    await page.getByPlaceholder('Search...').fill('UndoCategory')
    await expect(page.getByText('UndoCategory', { exact: true })).toBeVisible()
  })
})
