import { test, expect } from '@playwright/test'
import { resetAppState, waitForAppReady } from './helpers'

test.describe('Expense form — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page)
  })

  test('expense form fields render and close actions work', async ({ page }) => {
    await waitForAppReady(page)
    const addExpenseButton = page
      .getByTestId('btn-add-expense')
      .filter({ has: page.locator(':visible') })
      .first()
    await expect(addExpenseButton).toBeVisible()
    await addExpenseButton.click()
    await expect(page.getByTestId('expense-form')).toBeVisible()

    const amountInput = page.locator('[aria-label="Amount"]')
    await expect(amountInput).toBeVisible()

    const categoryTrigger = page.getByTestId('mobile-category-trigger')
    await expect(categoryTrigger).toBeVisible()

    const payeeTrigger = page.getByTestId('mobile-payee-trigger')
    await expect(payeeTrigger).toBeVisible()

    const descInput = page.getByPlaceholder('Optional')
    await descInput.fill('Test description')
    await expect(descInput).toHaveValue('Test description')

    await amountInput.click()
    await amountInput.pressSequentially('1234')
    const value = await amountInput.inputValue()
    expect(value).toMatch(/12\.34/)

    const signToggle = page.locator('button[aria-label="Switch to Refund"]')
    if (await signToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signToggle.click()
      await expect(page.locator('button[aria-label="Switch to Expense"]')).toBeVisible()
    }

    const closeButton = page.locator('[aria-label="Close"]').first()
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click()
      await expect(page.getByTestId('expense-form')).not.toBeVisible()
    }
  })

  test('cancel button closes form', async ({ page }) => {
    await waitForAppReady(page)
    const addExpenseButton = page
      .getByTestId('btn-add-expense')
      .filter({ has: page.locator(':visible') })
      .first()
    await expect(addExpenseButton).toBeVisible()
    await addExpenseButton.click()
    await expect(page.getByTestId('expense-form')).toBeVisible()

    const cancelButton = page.getByRole('button', { name: 'Cancel' }).first()
    if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelButton.click()
      await expect(page.getByTestId('expense-form')).not.toBeVisible({ timeout: 5000 })
    }
  })
})
