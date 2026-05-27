import { test, type Locator, type Page } from '@playwright/test'
import {
  expect,
  getOpenDesktopDropdownOptions,
  getFixedExpenseSnapshots,
  getIncomeSnapshots,
  openDesktopDropdown,
  getSavingsSnapshots,
  resetAppState,
} from './helpers'

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

async function openHistoricalModal(page: Page): Promise<Locator> {
  await page.getByTestId('btn-open-historical-data').click()
  const dialog = page.getByRole('dialog', { name: 'Edit Historical Data' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function saveHistoricalModal(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Confirm Save' }).click()
  await expect(dialog).not.toBeVisible({ timeout: 5000 })
}

async function expectTableRowValue(page: Page, label: string, value: string): Promise<void> {
  const row = page
    .locator('tr')
    .filter({ has: page.getByText(label, { exact: true }) })
    .first()
  await expect(row).toContainText(value)
}

test.describe('Edit Historical Data', () => {
  test('first-time backfill save writes snapshots', async ({ page }) => {
    const now = new Date()
    const targetYear = now.getFullYear() - 1

    await resetAppState(page, {
      route: '/settings',
      expenses: [{ date: `${targetYear}-03-15`, amount: 22.4, description: 'Archive seed' }],
      settings: {
        monthlyIncome: 4100,
        savingsRate: 18,
      },
    })

    const dialog = await openHistoricalModal(page)
    await dialog.getByRole('button', { name: /Use current: \$4,100\.00/ }).click()
    await dialog.getByRole('button', { name: /Use current: 18%/ }).click()
    await dialog.getByRole('button', { name: 'Rent', exact: true }).click()
    await expect(dialog.getByText('Preview')).toBeVisible()
    await saveHistoricalModal(dialog)

    await expect
      .poll(
        async () =>
          (await getIncomeSnapshots(page)).filter((snapshot) => snapshot.year === targetYear)
            .length,
      )
      .toBe(12)
    await expect
      .poll(
        async () =>
          (await getSavingsSnapshots(page)).filter((snapshot) => snapshot.year === targetYear)
            .length,
      )
      .toBe(12)
    await expect
      .poll(
        async () =>
          (await getFixedExpenseSnapshots(page)).filter((snapshot) => snapshot.year === targetYear)
            .length,
      )
      .toBe(12)

    const incomeSnapshots = (await getIncomeSnapshots(page)).filter(
      (snapshot) => snapshot.year === targetYear,
    )
    const savingsSnapshots = (await getSavingsSnapshots(page)).filter(
      (snapshot) => snapshot.year === targetYear,
    )
    const fixedSnapshots = (await getFixedExpenseSnapshots(page)).filter(
      (snapshot) => snapshot.year === targetYear,
    )

    expect(incomeSnapshots.every((snapshot) => snapshot.amountSnapshot === 4100)).toBe(true)
    expect(savingsSnapshots.every((snapshot) => snapshot.rateSnapshot === 18)).toBe(true)
    expect(fixedSnapshots.every((snapshot) => snapshot.amountSnapshot === 1200)).toBe(true)
    expect(fixedSnapshots.every((snapshot) => snapshot.nameSnapshot === 'Rent')).toBe(true)
  })

  test('editing existing historical snapshots and resaving updates persisted values', async ({
    page,
  }) => {
    const now = new Date()
    const targetYear = now.getFullYear() - 1

    await resetAppState(page, {
      route: '/settings',
      expenses: [{ date: `${targetYear}-02-10`, amount: 10, description: 'Seed' }],
      settings: {
        monthlyIncome: 4000,
        savingsRate: 10,
      },
    })

    let dialog = await openHistoricalModal(page)
    await dialog.getByRole('button', { name: /Use current: \$4,000\.00/ }).click()
    await dialog.getByRole('button', { name: /Use current: 10%/ }).click()
    await dialog.getByRole('button', { name: 'Rent', exact: true }).click()
    await saveHistoricalModal(dialog)

    dialog = await openHistoricalModal(page)
    await expect(dialog.getByPlaceholder('Name')).toHaveValue('Rent')

    const incomeInput = dialog.getByRole('textbox', { name: 'Amount' }).first()
    await incomeInput.click()
    await incomeInput.fill('4800')
    await incomeInput.press('Tab')

    const savingsInput = dialog.getByLabel('Savings rate percentage')
    await savingsInput.click()
    await savingsInput.press('ControlOrMeta+A')
    await savingsInput.type('2500')
    await expect(savingsInput).toHaveValue('25.00')

    const fixedNameInput = dialog.getByPlaceholder('Name')
    await fixedNameInput.fill('Mortgage')
    await expect(fixedNameInput).toHaveValue('Mortgage')
    await saveHistoricalModal(dialog)

    dialog = await openHistoricalModal(page)
    await expect(dialog.getByPlaceholder('Name')).toHaveValue('Mortgage')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()

    const incomeSnapshots = (await getIncomeSnapshots(page)).filter(
      (snapshot) => snapshot.year === targetYear,
    )
    const savingsSnapshots = (await getSavingsSnapshots(page)).filter(
      (snapshot) => snapshot.year === targetYear,
    )
    const fixedSnapshots = (await getFixedExpenseSnapshots(page)).filter(
      (snapshot) => snapshot.year === targetYear,
    )

    expect(incomeSnapshots).toHaveLength(12)
    expect(savingsSnapshots).toHaveLength(12)
    expect(fixedSnapshots).toHaveLength(12)
    expect(incomeSnapshots.every((snapshot) => snapshot.amountSnapshot === 4800)).toBe(true)
    expect(savingsSnapshots.every((snapshot) => snapshot.rateSnapshot === 25)).toBe(true)
    expect(fixedSnapshots.every((snapshot) => snapshot.nameSnapshot === 'Mortgage')).toBe(true)
  })

  test('current-year tab only allows past months and persists only editable month range', async ({
    page,
  }) => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const editableMonthCount = currentMonth - 1

    await resetAppState(page, {
      route: '/settings',
      expenses: [{ date: `${currentYear}-01-10`, amount: 35, description: 'Current-year seed' }],
      settings: {
        monthlyIncome: 3000,
      },
    })

    const dialog = await openHistoricalModal(page)
    const yearTab = dialog.getByRole('button', { name: String(currentYear), exact: true })

    if (editableMonthCount === 0) {
      await expect(yearTab).toHaveCount(0)
      await expect(
        dialog.getByText('No historical data available. There are no past months to edit yet.'),
      ).toBeVisible()
      await dialog.getByRole('button', { name: 'Cancel' }).click()
      await expect(dialog).not.toBeVisible()
      expect(
        (await getIncomeSnapshots(page)).filter((snapshot) => snapshot.year === currentYear),
      ).toHaveLength(0)
      return
    }

    await expect(yearTab).toBeVisible()
    await dialog.getByRole('button', { name: '+ Add income range' }).click()

    const incomeInput = dialog.getByRole('textbox', { name: 'Amount' }).first()
    await incomeInput.click()
    await incomeInput.fill('3000')
    await incomeInput.press('Tab')

    const endMonthTrigger = dialog.getByRole('button', { name: 'Month' }).nth(1)
    await openDesktopDropdown(page, endMonthTrigger)
    await expect(getOpenDesktopDropdownOptions(page)).toHaveCount(editableMonthCount)
    await expect(getOpenDesktopDropdownOptions(page).last()).toHaveText(
      MONTH_NAMES[editableMonthCount - 1],
    )
    if (editableMonthCount < 12) {
      await expect(
        getOpenDesktopDropdownOptions(page).filter({ hasText: MONTH_NAMES[editableMonthCount] }),
      ).toHaveCount(0)
    }
    await getOpenDesktopDropdownOptions(page)
      .filter({ hasText: MONTH_NAMES[editableMonthCount - 1] })
      .first()
      .click()

    await saveHistoricalModal(dialog)

    const incomeSnapshots = (await getIncomeSnapshots(page)).filter(
      (snapshot) => snapshot.year === currentYear,
    )
    expect(incomeSnapshots).toHaveLength(editableMonthCount)
    expect(
      incomeSnapshots.every(
        (snapshot) => snapshot.month >= 1 && snapshot.month <= editableMonthCount,
      ),
    ).toBe(true)
  })

  test('draft restore and discard uses draft banner flow without persisting unsaved edits', async ({
    page,
  }) => {
    const now = new Date()
    const targetYear = now.getFullYear() - 1

    await resetAppState(page, {
      route: '/settings',
      expenses: [{ date: `${targetYear}-06-05`, amount: 18, description: 'History seed' }],
    })

    let dialog = await openHistoricalModal(page)
    await dialog.getByRole('button', { name: '+ Add income range' }).click()

    const incomeInput = dialog.getByRole('textbox', { name: 'Amount' }).first()
    await incomeInput.click()
    await incomeInput.fill('3333')
    await incomeInput.press('Tab')

    await page.waitForTimeout(700)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()

    expect(
      (await getIncomeSnapshots(page)).filter((snapshot) => snapshot.year === targetYear),
    ).toHaveLength(0)

    dialog = await openHistoricalModal(page)
    await expect(dialog.getByText('Unsaved changes restored from your last session.')).toBeVisible()
    await expect(dialog.locator('input[aria-label="Amount"]')).toHaveCount(1)

    await dialog.getByRole('button', { name: 'Discard' }).click()
    await expect(dialog.getByText('Unsaved changes restored from your last session.')).toHaveCount(
      0,
    )
    await expect(dialog.locator('input[aria-label="Amount"]')).toHaveCount(0)
    await expect(dialog.getByText('No ranges configured.').first()).toBeVisible()

    expect(
      (await getIncomeSnapshots(page)).filter((snapshot) => snapshot.year === targetYear),
    ).toHaveLength(0)
  })

  test('saved historical data is reflected in the dashboard for that month', async ({ page }) => {
    const now = new Date()
    const targetYear = now.getFullYear() - 1
    const targetMonth = 2

    await resetAppState(page, {
      route: '/settings',
      expenses: [{ date: `${targetYear}-03-15`, amount: 100, description: 'March groceries' }],
      settings: {
        monthlyIncome: 5000,
        savingsRate: 20,
      },
    })

    const dialog = await openHistoricalModal(page)
    await dialog.getByRole('button', { name: /Use current: \$5,000\.00/ }).click()
    await dialog.getByRole('button', { name: /Use current: 20%/ }).click()
    await dialog.getByRole('button', { name: 'Rent', exact: true }).click()
    await saveHistoricalModal(dialog)

    await page.goto('/')
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await page.getByLabel(`Mar ${targetYear}`).click()

    await expectTableRowValue(page, 'Income', '$5,000.00')
    await expectTableRowValue(page, 'Auto Savings', '$1,000.00')
    await expectTableRowValue(page, 'Total Expenses', '$1,300.00')
    await expectTableRowValue(page, 'Remaining', '$2,700.00')
    await expectTableRowValue(page, 'Rent', '$1,200.00')

    const incomeSnapshots = (await getIncomeSnapshots(page)).filter(
      (snapshot) => snapshot.year === targetYear && snapshot.month === targetMonth + 1,
    )
    const savingsSnapshots = (await getSavingsSnapshots(page)).filter(
      (snapshot) => snapshot.year === targetYear && snapshot.month === targetMonth + 1,
    )
    const fixedSnapshots = (await getFixedExpenseSnapshots(page)).filter(
      (snapshot) => snapshot.year === targetYear && snapshot.month === targetMonth + 1,
    )

    expect(incomeSnapshots).toHaveLength(1)
    expect(savingsSnapshots).toHaveLength(1)
    expect(fixedSnapshots).toHaveLength(1)
    expect(incomeSnapshots[0]?.amountSnapshot).toBe(5000)
    expect(savingsSnapshots[0]?.rateSnapshot).toBe(20)
    expect(fixedSnapshots[0]?.amountSnapshot).toBe(1200)
  })
})
