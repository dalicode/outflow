import { test, expect } from '@playwright/test'
import { waitForAppReady } from './helpers'

test.describe('Smoke tests', () => {
  test('app loads and dashboard is visible', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('dashboard')).toBeVisible()
  })

  test('navigation works — all pages reachable', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // On desktop, nav links appear in the sidebar
    // Use .first() because both desktop and mobile nav render the same data-testid
    await page.getByTestId('nav-summary').first().click()
    await expect(page).toHaveURL(/\/summary/)
    await expect(page.getByTestId('summary-page')).toBeVisible()

    await page.getByTestId('nav-dashboard').first().click()
    await expect(page).toHaveURL(/\/$/)

    await page.getByTestId('nav-analytics').first().click()
    await expect(page).toHaveURL(/\/analytics/)
    await expect(page.getByTestId('analytics-page')).toBeVisible()

    await page.getByTestId('nav-payees').first().click()
    await expect(page).toHaveURL(/\/payees/)
    await expect(page.getByTestId('payees-page')).toBeVisible()

    await page.getByTestId('nav-settings').first().click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('add expense button opens expense form', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    const addExpenseButton = page
      .getByTestId('btn-add-expense')
      .filter({ has: page.locator(':visible') })
      .first()
    await expect(addExpenseButton).toBeVisible()
    await addExpenseButton.click()
    await expect(page.getByTestId('expense-form')).toBeVisible()
  })

  test('default categories are visible through the expense form', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    const addExpenseButton = page
      .getByTestId('btn-add-expense')
      .filter({ has: page.locator(':visible') })
      .first()
    await expect(addExpenseButton).toBeVisible()
    await addExpenseButton.click()
    await expect(page.getByTestId('expense-form')).toBeVisible()

    const categoryDropdown = page.getByTestId('desktop-category-dropdown')
    const categoryTrigger = categoryDropdown.getByRole('button')
    await expect(categoryTrigger).toBeVisible({ timeout: 15000 })
    await categoryTrigger.click()

    await expect(page.getByPlaceholder('Search...')).toBeVisible()
    await expect(page.getByText('Groceries', { exact: true })).toBeVisible()
    await expect(page.getByText('Transportation', { exact: true })).toBeVisible()
  })
})
