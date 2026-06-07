import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  expenses: { toArray: vi.fn() },
  categories: { toArray: vi.fn() },
  payees: { toArray: vi.fn() },
  fixedExpenses: { toArray: vi.fn() },
  expenseSplits: { toArray: vi.fn() },
  fixedExpenseSnapshots: { toArray: vi.fn() },
  incomeSnapshots: { toArray: vi.fn() },
  savingsSnapshots: { toArray: vi.fn() },
  schedules: { toArray: vi.fn() },
  settings: { toArray: vi.fn() },
}))

const supabaseFrom = vi.hoisted(() => vi.fn())

vi.mock('@/services/db/schema', () => ({
  default: mockDb,
}))

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: supabaseFrom,
  },
}))

import { runRecoveryDiagnostics } from '@/services/recoveryService'

function setLocalHealthyData() {
  mockDb.expenses.toArray.mockResolvedValue([
    { id: 1, categoryId: 10, payeeId: 20 },
    { id: 2, categoryId: 10 },
  ])
  mockDb.categories.toArray.mockResolvedValue([{ id: 10, name: 'Food' }])
  mockDb.payees.toArray.mockResolvedValue([{ id: 20, name: 'Cafe' }])
  mockDb.fixedExpenses.toArray.mockResolvedValue([])
  mockDb.expenseSplits.toArray.mockResolvedValue([])
  mockDb.fixedExpenseSnapshots.toArray.mockResolvedValue([])
  mockDb.incomeSnapshots.toArray.mockResolvedValue([{ year: 2026, month: 1, amountSnapshot: 1000 }])
  mockDb.savingsSnapshots.toArray.mockResolvedValue([{ year: 2026, month: 1, rateSnapshot: 0.2 }])
  mockDb.schedules.toArray.mockResolvedValue([])
  mockDb.settings.toArray.mockResolvedValue([])
}

describe('runRecoveryDiagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLocalHealthyData()
  })

  it('returns healthy when local data is valid', async () => {
    const report = await runRecoveryDiagnostics()
    expect(report.status).toBe('healthy')
    expect(report.issues).toHaveLength(0)
    expect(report.brokenExpenseCategoryRefs).toBe(0)
    expect(report.brokenExpensePayeeRefs).toBe(0)
    expect(report.brokenExpenseSplitRefs).toBe(0)
  })

  it('returns local_repair_required when local duplicates and broken refs exist', async () => {
    mockDb.expenses.toArray.mockResolvedValue([
      { id: 1, categoryId: 999, payeeId: 888, splitId: 777 },
    ])
    mockDb.categories.toArray.mockResolvedValue([
      { id: 10, name: 'Food' },
      { id: 11, name: 'food' },
    ])
    mockDb.payees.toArray.mockResolvedValue([
      { id: 20, name: 'Cafe' },
      { id: 21, name: '  cafe  ' },
    ])
    mockDb.expenseSplits.toArray.mockResolvedValue([])
    mockDb.incomeSnapshots.toArray.mockResolvedValue([
      { year: 2026, month: 1, amountSnapshot: 1000 },
      { year: 2026, month: 1, amountSnapshot: 1200 },
    ])
    mockDb.savingsSnapshots.toArray.mockResolvedValue([
      { year: 2026, month: 1, rateSnapshot: 0.2 },
      { year: 2026, month: 1, rateSnapshot: 0.3 },
    ])
    mockDb.fixedExpenseSnapshots.toArray.mockResolvedValue([
      { fixedExpenseId: 5, year: 2026, month: 1 },
      { fixedExpenseId: 5, year: 2026, month: 1 },
    ])

    const report = await runRecoveryDiagnostics()
    expect(report.status).toBe('local_repair_required')
    expect(report.brokenExpenseCategoryRefs).toBe(1)
    expect(report.brokenExpensePayeeRefs).toBe(1)
    expect(report.brokenExpenseSplitRefs).toBe(1)
    expect(report.duplicateIncomeSnapshots).toBe(1)
    expect(report.duplicateSavingsSnapshots).toBe(1)
    expect(report.duplicateFixedExpenseSnapshots).toBe(1)
    expect(report.duplicateCategoryNames).toBe(1)
    expect(report.duplicatePayeeNames).toBe(1)
  })

  it('returns rebuild_cloud_required when local is healthy but cloud counts drift', async () => {
    supabaseFrom.mockImplementation((table: string) => ({
      select: () => ({
        eq: () =>
          table === 'settings'
            ? Promise.resolve({
                data: [
                  { key: 'setting-1' },
                  { key: 'setting-2' },
                  { key: 'setting-3' },
                  { key: 'setting-4' },
                  { key: 'setting-5' },
                ],
                error: null,
              })
            : Promise.resolve({
                count:
                  table === 'expenses'
                    ? 200
                    : table === 'categories'
                      ? 10
                      : table === 'payees'
                        ? 20
                        : table === 'fixed_expenses'
                          ? 3
                          : table === 'expense_splits'
                            ? 4
                            : table === 'fixed_expense_snapshots'
                              ? 3
                              : table === 'income_snapshots'
                                ? 2
                                : table === 'savings_snapshots'
                                  ? 2
                                  : table === 'schedules'
                                    ? 1
                                    : 0,
                error: null,
              }),
      }),
    }))

    const report = await runRecoveryDiagnostics('user-1')
    expect(report.status).toBe('rebuild_cloud_required')
    expect(report.cloudCounts?.expenses).toBe(200)
    expect(report.issues).toContain('Expenses count mismatch: local 2, cloud 200')
    expect(report.issues).toContain('Categories count mismatch: local 1, cloud 10')
    expect(report.issues).toContain('Payees count mismatch: local 1, cloud 20')
    expect(report.issues).toContain('Fixed expenses count mismatch: local 0, cloud 3')
    expect(report.issues).toContain('Expense splits count mismatch: local 0, cloud 4')
    expect(report.issues).toContain('Fixed expense snapshots count mismatch: local 0, cloud 3')
    expect(report.issues).toContain('Income snapshots count mismatch: local 1, cloud 2')
    expect(report.issues).toContain('Savings snapshots count mismatch: local 1, cloud 2')
    expect(report.issues).toContain('Schedules count mismatch: local 0, cloud 1')
    expect(report.issues).toContain('Settings count mismatch: local 0, cloud 5')
  })

  it('ignores local-only settings when comparing cloud counts', async () => {
    mockDb.settings.toArray.mockResolvedValue([
      { key: 'monthlyIncome', value: 5000 },
      { key: 'localPrivacyModeEnabled', value: true },
      { key: 'dashboardExpenseTableDisplay', value: { mode: '2M', columns: 'detailed' } },
    ])

    supabaseFrom.mockImplementation((table: string) => ({
      select: () => ({
        eq: () =>
          table === 'settings'
            ? Promise.resolve({
                data: [
                  { key: 'monthlyIncome' },
                  { key: 'localPrivacyModeEnabled' },
                  { key: 'dashboardExpenseTableDisplay' },
                ],
                error: null,
              })
            : Promise.resolve({
                count:
                  table === 'expenses'
                    ? 2
                    : table === 'categories'
                      ? 1
                      : table === 'payees'
                        ? 1
                        : table === 'income_snapshots' || table === 'savings_snapshots'
                          ? 1
                          : 0,
                error: null,
              }),
      }),
    }))

    const report = await runRecoveryDiagnostics('user-1')

    expect(report.status).toBe('healthy')
    expect(report.localCounts.settings).toBe(1)
    expect(report.cloudCounts?.settings).toBe(1)
    expect(report.issues).not.toContain('Settings count mismatch: local 2, cloud 1')
    expect(report.issues).not.toContain('Settings count mismatch: local 3, cloud 1')
  })
})
