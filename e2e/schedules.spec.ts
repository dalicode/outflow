import { test, expect, type Page } from '@playwright/test'
import {
  addFixedExpense,
  addPayee,
  addSchedule,
  getAllExpenses,
  getCategories,
  getFixedExpenses,
  getSchedules,
  getSetting,
  resetAppState,
  selectDesktopDropdownOption,
  waitForRouteReady,
} from './helpers'

async function expectTableRowValue(page: Page, label: string, value: string): Promise<void> {
  const row = page
    .locator('tr')
    .filter({ has: page.getByText(label, { exact: true }) })
    .first()
  await expect(row).toContainText(value)
}

function formatDateForInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${month}/${day}/${year}`
}

async function openScheduleModal(page: Page) {
  await page.getByTestId('btn-add-schedule').click()
  const dialog = page.getByRole('dialog', { name: 'Add Schedule' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function setScheduleDateInput(dialog: ReturnType<Page['getByRole']>, value: string) {
  await dialog.locator('input[type="text"]').first().fill(value)
}

test.describe('Schedules — desktop', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      route: '/settings',
      settings: {
        monthlyIncome: 5000,
        savingsRate: 10,
      },
    })
  })

  test('creates schedules through the modal for every schedule type', async ({ page }) => {
    const fixedExpenseName = 'Rent'
    const expenseDate = new Date()
    expenseDate.setMonth(expenseDate.getMonth() + 1)
    const futureMonthInput = formatDateForInput(
      new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1),
    )
    const expenseDateInput = formatDateForInput(expenseDate)

    await addFixedExpense(page, { name: fixedExpenseName, amount: 1200 })

    const categories = await getCategories(page)
    const groceriesCategory = categories.find((category) => category.name === 'Groceries')
    expect(groceriesCategory?.id).toBeTruthy()

    let dialog = await openScheduleModal(page)
    await setScheduleDateInput(dialog, futureMonthInput)
    await dialog.getByTestId('schedule-value-input').fill('6000')
    await dialog.getByTestId('schedule-notes-input').fill('Salary increase')
    await dialog.getByTestId('btn-save-schedule').click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    dialog = await openScheduleModal(page)
    await selectDesktopDropdownOption(page, 'Schedule type', 'Auto Savings %')
    await setScheduleDateInput(dialog, futureMonthInput)
    await dialog.getByTestId('schedule-value-input').fill('20')
    await dialog.getByTestId('schedule-notes-input').fill('Boost savings')
    await dialog.getByTestId('btn-save-schedule').click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    dialog = await openScheduleModal(page)
    await selectDesktopDropdownOption(page, 'Schedule type', 'Fixed Expense')
    await setScheduleDateInput(dialog, futureMonthInput)
    await selectDesktopDropdownOption(page, 'Fixed expense', fixedExpenseName)
    await dialog.getByTestId('schedule-value-input').fill('1350')
    await dialog.getByTestId('schedule-notes-input').fill('Lease renewal')
    await dialog.getByTestId('btn-save-schedule').click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    dialog = await openScheduleModal(page)
    await selectDesktopDropdownOption(page, 'Schedule type', 'Expense')
    await expect(dialog.getByText('Payee', { exact: true })).toBeVisible()
    await selectDesktopDropdownOption(
      page,
      dialog.getByText('Select category', { exact: true }).first(),
      'Groceries',
    )
    await dialog.getByLabel('Amount').fill('42.50')
    const expenseDateInputField = dialog.locator('input[type="text"]').first()
    await expenseDateInputField.fill(expenseDateInput)
    await expenseDateInputField.press('Tab')
    await dialog.getByTestId('btn-save-schedule').click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    await expect(page.getByText('Upcoming')).toBeVisible()
    await expect(page.getByText('(Salary increase)')).toBeVisible()
    await expect(page.getByText('(Boost savings)')).toBeVisible()
    await expect(page.getByText('(Lease renewal)')).toBeVisible()
    await expect(page.getByText('(Groceries)')).toBeVisible()
    const scheduleItems = page.locator("[data-testid^='schedule-item-']")
    await expect(
      scheduleItems.filter({ hasText: 'Income' }).filter({ hasText: '$6000' }),
    ).toHaveCount(1)
    await expect(
      scheduleItems.filter({ hasText: 'Savings %' }).filter({ hasText: '20%' }),
    ).toHaveCount(1)
    await expect(
      scheduleItems.filter({ hasText: 'Fixed Exp.' }).filter({ hasText: '$1350' }),
    ).toHaveCount(1)
    await expect(
      scheduleItems.filter({ hasText: 'Expense' }).filter({ hasText: '$42.5' }),
    ).toHaveCount(1)

    const schedules = await getSchedules(page)
    expect(schedules).toHaveLength(4)
    expect(schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'income',
          newValue: 6000,
          notes: 'Salary increase',
          isActive: 1,
        }),
        expect.objectContaining({
          type: 'savingsRate',
          newValue: 20,
          notes: 'Boost savings',
          isActive: 1,
        }),
        expect.objectContaining({
          type: 'fixedExpense',
          newValue: 1350,
          notes: 'Lease renewal',
          isActive: 1,
        }),
        expect.objectContaining({
          type: 'expense',
          newValue: 42.5,
          categoryId: groceriesCategory?.id,
          isActive: 1,
          day: expenseDate.getDate(),
        }),
      ]),
    )
  })

  test('materializes due schedules for every schedule type on app startup', async ({ page }) => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentDay = now.getDate()
    const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

    const payeeId = await addPayee(page, 'Cafe Deluxe')
    const fixedExpenseId = await addFixedExpense(page, { name: 'Rent', amount: 1200 })

    const categories = await getCategories(page)
    const groceriesCategory = categories.find((category) => category.name === 'Groceries')
    expect(groceriesCategory?.id).toBeTruthy()

    await addSchedule(page, {
      type: 'income',
      targetId: null,
      effectiveYear: currentYear,
      effectiveMonth: currentMonth,
      newValue: 6200,
      notes: 'Salary increase',
    })
    await addSchedule(page, {
      type: 'savingsRate',
      targetId: null,
      effectiveYear: currentYear,
      effectiveMonth: currentMonth,
      newValue: 18,
      notes: 'Savings bump',
    })
    await addSchedule(page, {
      type: 'fixedExpense',
      targetId: fixedExpenseId,
      effectiveYear: currentYear,
      effectiveMonth: currentMonth,
      newValue: 1400,
      notes: 'Lease renewal',
    })
    await addSchedule(page, {
      type: 'expense',
      targetId: null,
      effectiveYear: currentYear,
      effectiveMonth: currentMonth,
      day: currentDay,
      newValue: 42.5,
      notes: 'Planned lunch',
      categoryId: groceriesCategory?.id,
      payeeId,
    })

    await page.reload()
    await waitForRouteReady(page, '/settings')

    await expect
      .poll(async () => {
        const expenses = await getAllExpenses(page)
        return expenses.length
      })
      .toBe(1)

    const [monthlyIncome, savingsRate, schedules, expenses, fixedExpenses, materializationLog] =
      await Promise.all([
        getSetting(page, 'monthlyIncome'),
        getSetting(page, 'savingsRate'),
        getSchedules(page),
        getAllExpenses(page),
        getFixedExpenses(page),
        getSetting(page, 'scheduleMaterializationLog'),
      ])

    await expect(page.getByText('(Salary increase)')).not.toBeVisible()
    await expect(page.getByText('(Savings bump)')).not.toBeVisible()
    await expect(page.getByText('(Lease renewal)')).not.toBeVisible()
    await expect(page.getByText('Archived')).toBeVisible()
    await expect(page.getByText('(Planned lunch)')).toBeVisible()

    expect(monthlyIncome).toBe(6200)
    expect(savingsRate).toBe(18)

    expect(fixedExpenses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixedExpenseId,
          name: 'Rent',
          amount: 1400,
        }),
      ]),
    )

    expect(expenses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: 42.5,
          date: `${currentMonthKey}-${String(currentDay).padStart(2, '0')}`,
          categoryId: groceriesCategory?.id,
          payeeId,
          notes: 'Planned lunch',
        }),
      ]),
    )

    expect(schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'income',
          isActive: 1,
          previousValue: 5000,
          materializedAt: currentMonthKey,
        }),
        expect.objectContaining({
          type: 'savingsRate',
          isActive: 1,
          previousValue: 10,
          materializedAt: currentMonthKey,
        }),
        expect.objectContaining({
          type: 'fixedExpense',
          isActive: 1,
          previousValue: 1200,
          materializedAt: currentMonthKey,
          targetId: fixedExpenseId,
        }),
        expect.objectContaining({
          type: 'expense',
          isActive: 0,
          notes: 'Planned lunch',
          day: currentDay,
        }),
      ]),
    )

    expect(materializationLog).toEqual(expect.any(Array))
    expect(materializationLog as unknown[]).toHaveLength(4)

    await page.goto('/')
    await waitForRouteReady(page, '/')
    await expectTableRowValue(page, 'Income', '$6,200.00')
    await expectTableRowValue(page, 'Auto Savings', '$1,116.00')
    await expectTableRowValue(page, 'Total Expenses', '$1,442.50')
    await expectTableRowValue(page, 'Remaining', '$3,641.50')
    await expectTableRowValue(page, 'Rent', '$1,400.00')
  })
})
