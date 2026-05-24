import { test, type Page } from '@playwright/test'
import {
  addCategory,
  addPayee,
  expect,
  resetAppState,
  seedExpenseSplit,
} from './helpers'

async function openExpensesView(page: Page): Promise<void> {
  await page.getByTestId('view-tab-expenses').first().click()
  await expect(page.getByTestId('expense-table')).toBeVisible({ timeout: 10000 })
}

async function selectDesktopDropdownOption(
  page: Page,
  testId: string,
  optionLabel: string,
): Promise<void> {
  const dropdown = page.getByTestId(testId)
  await dropdown.getByRole('button').click()
  const searchInput = page.locator('input[placeholder="Search..."]').last()
  await expect(searchInput).toBeVisible()
  await searchInput.fill(optionLabel)
  await page.getByText(optionLabel, { exact: true }).last().click()
}

async function openAnalyticsView(page: Page): Promise<void> {
  await page.goto('/analytics')
  await expect(page.getByTestId('analytics-page')).toBeVisible({ timeout: 15000 })
}

async function expectAnalyticsCategoryValues(
  page: Page,
  expected: Array<{ category: string; amount: string }>,
): Promise<void> {
  for (const item of expected) {
    await expect(page.getByText(item.category, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(item.amount, { exact: true }).first()).toBeVisible()
  }
}

async function createSplitExpenseThroughUi(
  page: Page,
  params: {
    payee: string
    parentDescription: string
    totalAmount: string
    allocations: Array<{ category: string; amount?: string; description: string }>
  },
): Promise<void> {
  await page.getByTestId('btn-add-expense').first().click()
  await expect(page.getByTestId('expense-form')).toBeVisible()

  await page.locator('[aria-label="Amount"]').fill(params.totalAmount)
  await selectDesktopDropdownOption(page, 'desktop-payee-dropdown', params.payee)
  await page.getByPlaceholder('Optional').first().fill(params.parentDescription)
  await page.getByRole('checkbox', { name: 'Enable split transaction' }).check({ force: true })

  for (let index = 1; index < params.allocations.length; index += 1) {
    await page.getByTestId('btn-add-split-row').click()
  }

  for (const [index, allocation] of params.allocations.entries()) {
    await page.getByLabel(`Split category ${index + 1}`).selectOption({ label: allocation.category })
    if (allocation.amount != null) {
      await page.getByLabel(`Split amount ${index + 1}`).fill(allocation.amount)
    }
    await page.getByLabel(`Split description ${index + 1}`).fill(allocation.description)
  }
}

test.describe('Split expenses (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page)
  })

  test('creates a split expense and verifies values in dashboard and analytics through the UI', async ({
    page,
  }) => {
    const diningCategory = 'Split Food E2E'
    const travelCategory = 'Split Travel E2E'
    const payeeName = 'Split Test Cafe'

    await addCategory(page, diningCategory)
    await addCategory(page, travelCategory)
    await addPayee(page, payeeName)

    await createSplitExpenseThroughUi(page, {
      payee: payeeName,
      parentDescription: 'Conference day split',
      totalAmount: '120.47',
      allocations: [
        { category: diningCategory, amount: '80.22', description: 'Meals' },
        { category: travelCategory, amount: '40.25', description: 'Taxi' },
      ],
    })

    await page.getByTestId('btn-save-expense').click()
    await expect(page.getByTestId('expense-form')).not.toBeVisible({ timeout: 10000 })

    await openExpensesView(page)

    const splitParentRow = page.locator("tr[data-testid^='split-container-']").first()
    await expect(splitParentRow).toBeVisible()
    await expect(splitParentRow).toContainText(payeeName)
    await expect(splitParentRow).toContainText('Conference day split')
    await expect(splitParentRow).toContainText('$120.47')

    const splitToggle = splitParentRow.getByRole('button', { name: /Split/ })
    await expect(splitToggle).toHaveAttribute('aria-expanded', 'true')

    const splitChildRows = page.locator("tr[data-testid^='split-child-']")
    await expect(splitChildRows).toHaveCount(2)
    await expect(
      splitChildRows.filter({ has: page.getByText(diningCategory, { exact: true }) }),
    ).toContainText('Meals')
    await expect(
      splitChildRows.filter({ has: page.getByText(diningCategory, { exact: true }) }),
    ).toContainText('$80.22')
    await expect(
      splitChildRows.filter({ has: page.getByText(travelCategory, { exact: true }) }),
    ).toContainText('Taxi')
    await expect(
      splitChildRows.filter({ has: page.getByText(travelCategory, { exact: true }) }),
    ).toContainText('$40.25')

    await splitToggle.click()
    await expect(splitToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(splitChildRows).toHaveCount(0)

    await splitToggle.click()
    await expect(splitToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(splitChildRows).toHaveCount(2)

    await openAnalyticsView(page)
    await expectAnalyticsCategoryValues(page, [
      { category: diningCategory, amount: '$80.22' },
      { category: travelCategory, amount: '$40.25' },
    ])
  })

  test('distributes an unbalanced split through the real save flow and preserves exact rounded values', async ({
    page,
  }) => {
    const firstCategory = 'Split Utilities E2E'
    const secondCategory = 'Split Fees E2E'
    const payeeName = 'Split Utility Provider'

    await addCategory(page, firstCategory)
    await addCategory(page, secondCategory)
    await addPayee(page, payeeName)

    await createSplitExpenseThroughUi(page, {
      payee: payeeName,
      parentDescription: 'Utility bill split',
      totalAmount: '10.01',
      allocations: [
        { category: firstCategory, description: 'Base service' },
        { category: secondCategory, description: 'Processing fee' },
      ],
    })

    await page.getByTestId('btn-save-expense').click()
    const distributeDialog = page.getByRole('dialog', { name: 'Split not balanced' })
    await expect(distributeDialog).toBeVisible()
    await distributeDialog.getByRole('button', { name: 'Distribute' }).click()
    await expect(page.getByTestId('expense-form')).not.toBeVisible({ timeout: 10000 })

    await openExpensesView(page)

    const splitParentRow = page.locator("tr[data-testid^='split-container-']").first()
    await expect(splitParentRow).toContainText('$10.01')

    const splitChildRows = page.locator("tr[data-testid^='split-child-']")
    await expect(splitChildRows).toHaveCount(2)
    await expect(
      splitChildRows.filter({ has: page.getByText(firstCategory, { exact: true }) }),
    ).toContainText('$5.00')
    await expect(
      splitChildRows.filter({ has: page.getByText(secondCategory, { exact: true }) }),
    ).toContainText('$5.01')

    await openAnalyticsView(page)
    await expectAnalyticsCategoryValues(page, [
      { category: firstCategory, amount: '$5.00' },
      { category: secondCategory, amount: '$5.01' },
    ])
  })

  test('edits an existing split through the desktop UI and updates dashboard and analytics values', async ({
    page,
  }) => {
    const foodCategory = await addCategory(page, 'Split Edit Food E2E')
    const travelCategory = await addCategory(page, 'Split Edit Travel E2E')
    const oldPayeeId = await addPayee(page, 'Original Split Payee')
    await addPayee(page, 'Updated Split Payee')

    await seedExpenseSplit(page, {
      split: {
        date: '2026-05-18',
        amount: 120,
        payeeId: oldPayeeId,
        payeeNameSnapshot: 'Original Split Payee',
        description: 'Original split description',
        note: '',
      },
      children: [
        { categoryId: foodCategory, amount: 70, description: 'Meals' },
        { categoryId: travelCategory, amount: 50, description: 'Ride' },
      ],
    })

    await page.goto('/')
    await openExpensesView(page)

    const splitParentRow = page.locator("tr[data-testid^='split-container-']").first()
    await splitParentRow.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit split transaction' }).click()

    const form = page.getByTestId('expense-form')
    await expect(form).toBeVisible()
    await expect(page.getByTestId('split-loading')).not.toBeVisible({ timeout: 10000 })

    await page.locator('[aria-label="Amount"]').fill('135.00')
    await selectDesktopDropdownOption(page, 'desktop-payee-dropdown', 'Updated Split Payee')
    await page.getByPlaceholder('Optional').first().fill('Updated split description')
    await page.getByLabel('Split amount 1').fill('90.00')
    await page.getByLabel('Split amount 2').fill('45.00')

    await page.getByTestId('btn-save-expense').click()
    await expect(form).not.toBeVisible({ timeout: 10000 })

    await expect(splitParentRow).toContainText('Updated Split Payee')
    await expect(splitParentRow).toContainText('Updated split description')
    await expect(splitParentRow).toContainText('$135.00')

    const splitChildRows = page.locator("tr[data-testid^='split-child-']")
    await expect(
      splitChildRows.filter({ has: page.getByText('Split Edit Food E2E', { exact: true }) }),
    ).toContainText('$90.00')
    await expect(
      splitChildRows.filter({ has: page.getByText('Split Edit Travel E2E', { exact: true }) }),
    ).toContainText('$45.00')

    await openAnalyticsView(page)
    await expectAnalyticsCategoryValues(page, [
      { category: 'Split Edit Food E2E', amount: '$90.00' },
      { category: 'Split Edit Travel E2E', amount: '$45.00' },
    ])
  })

  test('unsplits a split transaction from the desktop context menu and keeps visible totals consistent', async ({
    page,
  }) => {
    const groceryCategory = await addCategory(page, 'Split Unsplit Food E2E')
    const taxiCategory = await addCategory(page, 'Split Unsplit Travel E2E')
    const payeeId = await addPayee(page, 'Split Unsplit Payee')

    await seedExpenseSplit(page, {
      split: {
        date: '2026-05-21',
        amount: 48,
        payeeId,
        payeeNameSnapshot: 'Split Unsplit Payee',
        description: 'Trip day split',
        note: '',
      },
      children: [
        { categoryId: groceryCategory, amount: 18, description: 'Breakfast' },
        { categoryId: taxiCategory, amount: 30, description: 'Taxi' },
      ],
    })

    await page.goto('/')
    await openExpensesView(page)

    const splitParentRow = page.locator("tr[data-testid^='split-container-']").first()
    await splitParentRow.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Unsplit transaction' }).click()

    await expect(page.locator("tr[data-testid^='split-container-']")).toHaveCount(0)
    const expenseRows = page.locator("tr[data-testid^='expense-']")
    await expect(expenseRows).toHaveCount(2)
    await expect(expenseRows.filter({ hasText: 'Breakfast' })).toHaveCount(1)
    await expect(expenseRows.filter({ hasText: 'Taxi' })).toHaveCount(1)
    await expect(expenseRows.filter({ hasText: '$18.00' })).toHaveCount(1)
    await expect(expenseRows.filter({ hasText: '$30.00' })).toHaveCount(1)

    await openAnalyticsView(page)
    await expectAnalyticsCategoryValues(page, [
      { category: 'Split Unsplit Food E2E', amount: '$18.00' },
      { category: 'Split Unsplit Travel E2E', amount: '$30.00' },
    ])
  })
})
