import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

type TestApi = typeof import('../src/test/testApi').testApi

function padMonthPart(value: number): string {
  return String(value).padStart(2, '0')
}

function getMonthOffsetDate(monthOffset: number): Date {
  const value = new Date()
  return new Date(value.getFullYear(), value.getMonth() + monthOffset, 1)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getMonthOffsetIsoDate(day: number, monthOffset = 0): string {
  const value = getMonthOffsetDate(monthOffset)
  return `${value.getFullYear()}-${padMonthPart(value.getMonth() + 1)}-${padMonthPart(day)}`
}

export function getMonthOffsetLabel(monthOffset = 0, month: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat('en-US', {
    month,
    year: 'numeric',
  }).format(getMonthOffsetDate(monthOffset))
}

function resolveDropdownTrigger(page: Page, trigger: Locator | string): Locator {
  return typeof trigger === 'string'
    ? page.getByRole('button', { name: trigger, exact: true })
    : trigger
}

export async function openDesktopDropdown(page: Page, trigger: Locator | string): Promise<void> {
  await resolveDropdownTrigger(page, trigger).click()
}

export function getOpenDesktopDropdownOptions(page: Page): Locator {
  return page.locator('[id^="desktop-dropdown-option-"]')
}

export async function selectDesktopDropdownOption(
  page: Page,
  trigger: Locator | string,
  optionName: string,
): Promise<void> {
  await openDesktopDropdown(page, trigger)

  const searchInputs = page.getByPlaceholder('Search...')
  if (await searchInputs.count()) {
    await searchInputs.last().fill(optionName)
  }

  await getOpenDesktopDropdownOptions(page)
    .filter({ hasText: new RegExp(`^${escapeRegExp(optionName)}$`) })
    .first()
    .click()
}

export interface SeedExpenseEntry {
  date: string
  amount: number
  categoryId?: number
  payeeId?: number
  description?: string
  notes?: string
}

export interface SeedExpenseSplitInput {
  split: {
    date: string
    amount: number
    payeeId?: number
    payeeNameSnapshot?: string | null
    description?: string
    note?: string
    notes?: string
  }
  children: Array<{
    categoryId: number
    amount: number
    description?: string
    notes?: string
    payeeId?: number
  }>
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.getByTestId('dashboard').waitFor({ timeout: 15000 })
}

export async function gotoAndWait(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  if (
    path === '/' ||
    path === '/summary' ||
    path === '/analytics' ||
    path === '/payees' ||
    path === '/settings'
  ) {
    await waitForAppReady(page).catch(() => undefined)
  }
}

async function waitForTestApi(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        return Boolean((window as Window & { outflowTestApi?: unknown }).outflowTestApi)
      })
    }, { timeout: 15000 })
    .toBe(true)
}

export async function clearAllData(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found – is the app running in dev mode?')
    await api.clearAllData()
  })
}

export async function seedExpenses(page: Page, entries: SeedExpenseEntry[]): Promise<void> {
  await page.evaluate(
    async (data) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.seedExpenses(data)
    },
    entries.map((entry) => ({
      ...entry,
      notes: entry.notes ?? entry.description ?? '',
    })),
  )
}

export async function seedSettings(page: Page, settings: Record<string, unknown>): Promise<void> {
  await page.evaluate(async (data) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.seedSettings(data)
  }, settings)
}

export async function seedExpenseSplit(page: Page, params: SeedExpenseSplitInput): Promise<void> {
  await page.evaluate(
    async (data) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.seedExpenseSplit(data)
    },
    {
      split: {
        ...params.split,
        notes: params.split.notes ?? params.split.note ?? params.split.description ?? '',
      },
      children: params.children.map((child) => ({
        ...child,
        notes: child.notes ?? child.description ?? '',
      })),
    },
  )
}

export async function addCategory(page: Page, name: string): Promise<number> {
  return page.evaluate(async (categoryName) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.addCategory(categoryName)
  }, name)
}

export async function addPayee(page: Page, name: string): Promise<number> {
  return page.evaluate(async (payeeName) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.addPayee(payeeName)
  }, name)
}

export async function addFixedExpense(
  page: Page,
  item: { name: string; amount: number },
): Promise<number> {
  return page.evaluate(async (fixedExpense) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.addFixedExpense(fixedExpense)
  }, item)
}

export async function exportAllData(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.exportAllData()
  })
}

export async function importAllData(
  page: Page,
  data: Record<string, unknown>,
  opts?: { replace?: boolean },
): Promise<void> {
  await page.evaluate(
    async ({ importData, importOpts }) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.importAllData(importData, importOpts)
    },
    { importData: data, importOpts: opts },
  )
}

export async function getCategories(page: Page): Promise<Array<{ id?: number; name: string }>> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getCategories()
  })
}

export async function getAllExpenses(page: Page): Promise<
  Array<{
    id?: number
    localId?: string
    date: string
    amount: number
    description?: string
    notes?: string
    categoryId?: number
    payeeId?: number
  }>
> {
  await waitForTestApi(page)
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    const expenses = await api.getAllExpenses()
    return expenses.map((expense) => ({
      ...expense,
      description: expense.description ?? expense.notes ?? '',
      notes: expense.notes ?? expense.description ?? '',
    }))
  })
}

export async function getAllExpensesIncludingDeleted(page: Page): Promise<
  Array<{
    id?: number
    localId?: string
    date: string
    amount: number
    description?: string
    notes?: string
    syncStatus?: string
    deletedAt?: string | null
  }>
> {
  await waitForTestApi(page)
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    const expenses = await api.getAllExpensesIncludingDeleted()
    return expenses.map((expense) => ({
      ...expense,
      description: expense.description ?? expense.notes ?? '',
      notes: expense.notes ?? expense.description ?? '',
    }))
  })
}

export async function getPayees(
  page: Page,
): Promise<
  Array<{ id?: number; name: string; isArchived?: boolean; mergedIntoPayeeId?: number | null }>
> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getPayees()
  })
}

export async function getTags(
  page: Page,
): Promise<
  Array<{ id?: number; name: string; isArchived?: boolean; mergedIntoTagId?: number | null }>
> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getTags()
  })
}

export async function getFixedExpenses(
  page: Page,
): Promise<Array<{ id?: number; name: string; amount: number; isArchived?: boolean }>> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getFixedExpenses()
  })
}

export async function getIncomeSnapshots(
  page: Page,
): Promise<Array<{ year: number; month: number; amountSnapshot: number }>> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getAllIncomeSnapshots()
  })
}

export async function getSavingsSnapshots(
  page: Page,
): Promise<Array<{ year: number; month: number; rateSnapshot: number }>> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getAllSavingsSnapshots()
  })
}

export async function getFixedExpenseSnapshots(
  page: Page,
): Promise<Array<{ year: number; month: number; amountSnapshot: number; nameSnapshot: string }>> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getAllFixedExpenseSnapshots()
  })
}

export async function getFirstCategoryId(page: Page): Promise<number> {
  const categories = await getCategories(page)
  const id = categories[0]?.id
  if (!id) {
    throw new Error('No seeded categories available')
  }
  return id
}

export async function resetAppState(
  page: Page,
  options?: {
    route?: string
    expenses?: SeedExpenseEntry[]
    settings?: Record<string, unknown>
  },
): Promise<void> {
  await gotoAndWait(page, '/')
  await clearAllData(page)

  if (options?.settings) {
    await seedSettings(page, options.settings)
  }

  if (options?.expenses?.length) {
    const categoryId = await getFirstCategoryId(page)
    const normalized = options.expenses.map((entry) => ({
      ...entry,
      categoryId: entry.categoryId ?? categoryId,
    }))
    await seedExpenses(page, normalized)
  }

  await page.goto(options?.route ?? '/')
  await waitForRouteReady(page, options?.route ?? '/')
}

export async function waitForRouteReady(page: Page, path: string): Promise<void> {
  if (path === '/') {
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15000 })
    return
  }

  if (path === '/summary') {
    await expect(page.getByTestId('summary-page')).toBeVisible({ timeout: 15000 })
    return
  }

  if (path === '/analytics') {
    await expect(page.getByTestId('analytics-page')).toBeVisible({ timeout: 15000 })
    return
  }

  if (path === '/payees') {
    await expect(page.getByTestId('payees-page')).toBeVisible({ timeout: 15000 })
    return
  }

  if (path === '/settings') {
    await expect(page.getByRole('heading', { name: 'Settings' }))
      .toBeVisible({ timeout: 15000 })
      .catch(() => {
        if (!page.url().includes('/settings')) {
          throw new Error(`Not on settings page: ${page.url()}`)
        }
      })
    return
  }

  await page.waitForLoadState('networkidle')
}

export async function navigateToExpenseForm(page: Page): Promise<void> {
  await page.getByTestId('btn-add-expense').first().click()
  await page.getByTestId('expense-form').waitFor()
}

export async function openMobileSecondaryNav(page: Page): Promise<void> {
  const handle = page.getByRole('button', { name: 'Expand navigation' })
  const box = await handle.boundingBox()
  if (!box) {
    throw new Error('Mobile navigation handle is not measurable')
  }

  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2

  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX, centerY - 96, { steps: 6 })
  await page.mouse.up()

  await expect(page.locator('.mobile-nav-row-secondary').getByTestId('nav-analytics')).toBeVisible({
    timeout: 2000,
  })
}

export async function longPressElement(
  page: Page,
  selector: string,
  durationMs = 650,
): Promise<void> {
  const locator = page.locator(selector).first()
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`Element for long press is not measurable: ${selector}`)
  }

  const clientX = Math.round(box.x + box.width / 2)
  const clientY = Math.round(box.y + box.height / 2)

  const touchPayload = {
    bubbles: true,
    cancelable: true,
    composed: true,
    touches: [{ identifier: 1, clientX, clientY }],
    targetTouches: [{ identifier: 1, clientX, clientY }],
    changedTouches: [{ identifier: 1, clientX, clientY }],
  }

  await locator.dispatchEvent('touchstart', touchPayload)
  await page.waitForTimeout(durationMs)
  await locator.dispatchEvent('touchend', {
    bubbles: true,
    cancelable: true,
    composed: true,
    touches: [],
    targetTouches: [],
    changedTouches: [{ identifier: 1, clientX, clientY }],
  })
}

export async function getSchedules(page: Page): Promise<
  Array<{
    id?: number
    type: string
    effectiveYear: number
    effectiveMonth: number
    newValue: number
    isActive: number
    note?: string
    targetId?: number | null
    previousValue?: number | null
    materializedAt?: string
    day?: number
    categoryId?: number
    payeeId?: number
  }>
> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getSchedules()
  })
}

export async function addSchedule(
  page: Page,
  schedule: Parameters<TestApi['addSchedule']>[0],
): Promise<void> {
  await page.evaluate(
    async (data) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.addSchedule(data)
    },
    {
      ...schedule,
      notes:
        'notes' in schedule && typeof schedule.notes === 'string'
          ? schedule.notes
          : 'note' in schedule && typeof schedule.note === 'string'
            ? schedule.note
            : '',
    },
  )
}

export async function deleteSchedule(page: Page, id: number): Promise<void> {
  await page.evaluate(async (scheduleId) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.deleteSchedule(scheduleId)
  }, id)
}

export async function materializePendingSnapshots(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.materializePendingSnapshots()
  })
}

export async function getSetting(page: Page, key: string): Promise<unknown> {
  return page.evaluate(async (settingKey) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getSetting(settingKey)
  }, key)
}

export async function getFirstExpenseId(page: Page): Promise<number> {
  const expenses = await getAllExpenses(page)
  return expenses[0]?.id ?? 0
}

export async function getTagIdsForExpense(page: Page, expenseId: number): Promise<number[]> {
  return page.evaluate(async (id) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getTagIdsForExpense(id)
  }, expenseId)
}

export async function addTag(page: Page, name: string): Promise<number> {
  return page.evaluate(async (tagName) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.addTag(tagName)
  }, name)
}

export async function updateTag(
  page: Page,
  tagId: number,
  changes: { name?: string },
): Promise<void> {
  await page.evaluate(
    async ({ id, nextChanges }) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.updateTag(id, nextChanges)
    },
    { id: tagId, nextChanges: changes },
  )
}

export async function setExpenseTags(
  page: Page,
  expenseId: number,
  tagIds: number[],
): Promise<void> {
  await page.evaluate(
    async ({ id, ids }) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.setExpenseTags(id, ids)
    },
    { id: expenseId, ids: tagIds },
  )
}

export async function setFakeSignedInUser(
  page: Page,
  userId: string,
  email: string,
): Promise<void> {
  await page.evaluate(
    async ({ nextUserId, nextEmail }) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.setFakeSignedInUser(nextUserId, nextEmail)
    },
    { nextUserId: userId, nextEmail: email },
  )

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const api = (
          window as Window & {
            outflowTestApi?: typeof import('../src/test/testApi').testApi
          }
        ).outflowTestApi
        if (!api) throw new Error('outflowTestApi not found')
        return api.getCurrentSyncUserId()
      })
    })
    .toBe(userId)
}

export async function resetFakeCloud(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.resetFakeCloud()
  })
}

export async function seedFakeCloudExpenses(
  page: Page,
  userId: string,
  entries: Array<Record<string, unknown>>,
): Promise<void> {
  await page.evaluate(
    async ({ nextUserId, nextEntries }) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.seedFakeCloudExpenses(nextUserId, nextEntries)
    },
    { nextUserId: userId, nextEntries: entries },
  )
}

export async function inspectFakeCloudExpenses(
  page: Page,
  userId: string,
): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(async (nextUserId) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    const rows = await api.inspectFakeCloudExpenses(nextUserId)
    return rows.map((row) => {
      const notes =
        typeof row.notes === 'string'
          ? row.notes
          : typeof row.description === 'string'
            ? row.description
            : ''
      return {
        ...row,
        notes,
        description:
          typeof row.description === 'string' && row.description.length > 0
            ? row.description
            : notes,
      }
    })
  }, userId)
}

export async function triggerManualSync(page: Page): Promise<void> {
  await waitForTestApi(page)
  await page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.triggerManualSync()
  })
}

export async function getSyncDebugState(page: Page): Promise<{
  userId: string | null
  syncStatus: 'idle' | 'syncing' | 'offline' | 'error'
  syncCount: number
  pullAppliedCount: number
}> {
  await waitForTestApi(page)
  return page.evaluate(() => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getSyncDebugState()
  })
}

export async function waitForSyncStatus(
  page: Page,
  status: 'idle' | 'syncing' | 'offline' | 'error',
  options?: { timeout?: number },
): Promise<void> {
  await expect
    .poll(
      async () => {
        const state = await getSyncDebugState(page)
        return state.syncStatus
      },
      { timeout: options?.timeout ?? 20000 },
    )
    .toBe(status)
}

export async function waitForSyncSettled(
  page: Page,
  options?: { allowFailed?: boolean; timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 45000
  let pendingRetryCount = 0
  await expect
    .poll(
      async () => {
        let [diagnostics, state] = await Promise.all([
          getSyncMetadataDiagnostics(page),
          getSyncDebugState(page),
        ])
        if (state.syncStatus === 'syncing') {
          return `syncing:count=${state.syncCount}:pullApplied=${state.pullAppliedCount}`
        }
        if (diagnostics.pending > 0) {
          if (pendingRetryCount < 2 && state.syncStatus === 'idle') {
            pendingRetryCount += 1
            await triggerManualSync(page)
          }
          if (state.syncStatus === 'idle') {
            await page.waitForTimeout(200)
            ;[diagnostics, state] = await Promise.all([
              getSyncMetadataDiagnostics(page),
              getSyncDebugState(page),
            ])
            if (state.syncStatus === 'syncing') {
              return `syncing:count=${state.syncCount}:pullApplied=${state.pullAppliedCount}`
            }
            if (diagnostics.pending === 0) return 'settled'
          }
          const tableSummary = diagnostics.byTable
            .map((table) => `${table.table}:${table.pending}`)
            .join(',')
          return `pending:${diagnostics.pending}:${tableSummary}`
        }
        if (!options?.allowFailed && diagnostics.failed > 0) {
          const tableSummary = diagnostics.byTable
            .filter((table) => table.failed > 0)
            .map((table) => `${table.table}:${table.failed}`)
            .join(',')
          return `failed:${diagnostics.failed}:${tableSummary}`
        }
        return 'settled'
      },
      { timeout },
    )
    .toBe('settled')
}

export async function signInLiveSupabaseUser(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.evaluate(
    async ({ nextEmail, nextPassword }) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.signInLiveSupabaseUser(nextEmail, nextPassword)
    },
    { nextEmail: email, nextPassword: password },
  )

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const api = (
          window as Window & {
            outflowTestApi?: typeof import('../src/test/testApi').testApi
          }
        ).outflowTestApi
        if (!api) throw new Error('outflowTestApi not found')
        const userId = api.getCurrentSyncUserId()
        return typeof userId === 'string' && userId.length > 0
      })
    })
    .toBe(true)
}

export async function signOutLiveSupabaseUser(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.signOutLiveSupabaseUser()
  })
}

export async function clearLiveSupabaseUserData(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.clearLiveSupabaseUserData()
  })
}

export async function resetLiveSupabaseSession(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.resetLiveSupabaseSession()
  })
}

export async function getSyncMetadataCounts(
  page: Page,
): Promise<{ pending: number; failed: number }> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getSyncMetadataCounts()
  })
}

export async function getSyncMetadataDiagnostics(page: Page): Promise<{
  pending: number
  failed: number
  byTable: Array<{ table: string; pending: number; failed: number }>
}> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    return api.getSyncMetadataDiagnostics()
  })
}

async function markDefaultSeedRowsSyncedForSyncTest(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.markDefaultSeedRowsSyncedForSyncTest()
  })
}

async function markSettingsRowsSyncedForSyncTest(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.markSettingsRowsSyncedForSyncTest()
  })
}

function formatSyncDiagnostics(diagnostics: {
  pending: number
  failed: number
  byTable: Array<{ table: string; pending: number; failed: number }>
}): string {
  const tableSummary = diagnostics.byTable
    .map((row) => `${row.table}(pending=${row.pending},failed=${row.failed})`)
    .join(', ')
  return `pending=${diagnostics.pending} failed=${diagnostics.failed} byTable=[${tableSummary}]`
}

async function settleLiveSyncDefaults(page: Page, label: string): Promise<void> {
  let diagnostics = await getSyncMetadataDiagnostics(page)

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (diagnostics.pending === 0 && diagnostics.failed === 0) return

    await triggerManualSync(page)
    diagnostics = await getSyncMetadataDiagnostics(page)
  }

  if (diagnostics.pending > 0 || diagnostics.failed > 0) {
    const onlyDefaultSeedPending =
      diagnostics.failed === 0 &&
      diagnostics.byTable.every(
        (row) =>
          (row.table === 'categories' || row.table === 'payees') &&
          row.pending > 0 &&
          row.failed === 0,
      )

    if (onlyDefaultSeedPending) {
      await markDefaultSeedRowsSyncedForSyncTest(page)
      diagnostics = await getSyncMetadataDiagnostics(page)
      if (diagnostics.pending === 0 && diagnostics.failed === 0) return
    }

    const onlySettingsPending =
      diagnostics.failed === 0 &&
      diagnostics.byTable.length === 1 &&
      diagnostics.byTable[0]?.table === 'settings' &&
      diagnostics.byTable[0].pending > 0 &&
      diagnostics.byTable[0].failed === 0

    if (onlySettingsPending) {
      await markSettingsRowsSyncedForSyncTest(page)
      diagnostics = await getSyncMetadataDiagnostics(page)
      if (diagnostics.pending === 0 && diagnostics.failed === 0) return
    }

    throw new Error(
      `[resetLiveSyncState:${label}] sync did not settle after retry: ${formatSyncDiagnostics(
        diagnostics,
      )}`,
    )
  }
}

export async function updateExpenseForSyncTest(
  page: Page,
  expenseId: number,
  changes: Parameters<TestApi['updateExpenseForSyncTest']>[1],
): Promise<void> {
  await page.evaluate(
    async ({ nextExpenseId, nextChanges }) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.updateExpenseForSyncTest(nextExpenseId, nextChanges)
    },
    { nextExpenseId: expenseId, nextChanges: changes },
  )
}

export async function updateExpenseForSyncTestWithTimestamp(
  page: Page,
  expenseId: number,
  changes: Parameters<TestApi['updateExpenseForSyncTestWithTimestamp']>[1],
  updatedAt: string,
): Promise<void> {
  await page.evaluate(
    async ({ nextExpenseId, nextChanges, nextUpdatedAt }) => {
      const api = (
        window as Window & {
          outflowTestApi?: typeof import('../src/test/testApi').testApi
        }
      ).outflowTestApi
      if (!api) throw new Error('outflowTestApi not found')
      await api.updateExpenseForSyncTestWithTimestamp(nextExpenseId, nextChanges, nextUpdatedAt)
    },
    { nextExpenseId: expenseId, nextChanges: changes, nextUpdatedAt: updatedAt },
  )
}

export async function deleteExpenseForSyncTest(page: Page, expenseId: number): Promise<void> {
  await page.evaluate(async (nextExpenseId) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.deleteExpenseForSyncTest(nextExpenseId)
  }, expenseId)
}

export async function restoreExpenseForSyncTest(page: Page, expenseId: number): Promise<void> {
  await page.evaluate(async (nextExpenseId) => {
    const api = (
      window as Window & {
        outflowTestApi?: typeof import('../src/test/testApi').testApi
      }
    ).outflowTestApi
    if (!api) throw new Error('outflowTestApi not found')
    await api.restoreExpenseForSyncTest(nextExpenseId)
  }, expenseId)
}

export async function resetLiveSyncState(
  pages: Page[],
  email: string,
  password: string,
): Promise<void> {
  if (pages.length === 0) return

  for (const page of pages) {
    await gotoAndWait(page, '/')
    await clearAllData(page)
  }

  await signInLiveSupabaseUser(pages[0], email, password)
  await clearLiveSupabaseUserData(pages[0])
  await clearAllData(pages[0])
  await signOutLiveSupabaseUser(pages[0])

  for (const [index, page] of pages.entries()) {
    await signInLiveSupabaseUser(page, email, password)
    await clearAllData(page)
    await settleLiveSyncDefaults(page, `page-${index}`)
  }
}

export { expect }
