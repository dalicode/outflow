import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getMonthlyFinancialSummary,
  getYearFinancialSummary,
  getYearVariableGrid,
  getEditHistoricalDataPreviewTimeline,
  MONTHS,
} from '../utils/financeEngine'
import type { FinanceEngineData, Expense, FixedExpense, FixedExpenseSnapshot, Schedule } from '../types'

// ── Helpers ─────────────────────────────────────────────────────────────────

const makeExpense = (overrides: Partial<Expense> = {}): Expense => ({
  date: '2024-01-15',
  amount: 100,
  category: 'Food',
  ...overrides,
})

const makeSnapshot = (overrides: Partial<FixedExpenseSnapshot> = {}): FixedExpenseSnapshot => ({
  fixedExpenseId: 1,
  year: 2024,
  month: 1,
  nameSnapshot: 'Rent',
  amountSnapshot: 1500,
  ...overrides,
})

const makeFixed = (overrides: Partial<FixedExpense> = {}): FixedExpense => ({
  id: 1,
  name: 'Rent',
  amount: 1500,
  ...overrides,
})

const baseData: FinanceEngineData = {
  expenses: [],
  snapshots: [],
  fixedExpenses: [],
  globalIncome: 5000,
  globalSavingsRate: 20,
  schedules: [],
}

// ── getMonthlyFinancialSummary ──────────────────────────────────────────────

describe('getMonthlyFinancialSummary', () => {
  it('computes basic monthly summary with defaults', () => {
    const result = getMonthlyFinancialSummary(2024, 0, baseData)

    expect(result.income).toBe(5000)
    expect(result.savingsRate).toBe(20)
    expect(result.autoSavings).toBe(1000) // 5000 * 0.20
    expect(result.fixedExpensesTotal).toBe(0)
    expect(result.variableExpenses).toBe(0)
    expect(result.remaining).toBe(4000) // 5000 - 0 - 1000 - 0
  })

  it('includes fixed expenses from snapshots', () => {
    const data: FinanceEngineData = {
      ...baseData,
      snapshots: [makeSnapshot({ year: 2024, month: 1, amountSnapshot: 1500 })],
      fixedExpenses: [makeFixed({ id: 1, amount: 1500 })],
    }

    const result = getMonthlyFinancialSummary(2024, 0, data)
    expect(result.fixedExpensesTotal).toBe(1500)
    expect(result.fixedExpenses).toHaveLength(1)
    expect(result.fixedExpenses[0].name).toBe('Rent')
    expect(result.remaining).toBe(2500) // 5000 - 1500 - 1000 - 0
  })

  it('includes variable expenses for the month', () => {
    const data: FinanceEngineData = {
      ...baseData,
      expenses: [
        makeExpense({ date: '2024-01-05', amount: 50 }),
        makeExpense({ date: '2024-01-20', amount: 75 }),
        makeExpense({ date: '2024-02-10', amount: 200 }), // different month
      ],
    }

    const result = getMonthlyFinancialSummary(2024, 0, data)
    expect(result.variableExpenses).toBe(125)
    expect(result.remaining).toBe(3875) // 5000 - 0 - 1000 - 125
  })

  it('uses income snapshots', () => {
    const data: FinanceEngineData = {
      ...baseData,
      incomeSnapshots: [{ year: 2024, month: 1, amountSnapshot: 6000 }],
    }

    const result = getMonthlyFinancialSummary(2024, 0, data)
    expect(result.income).toBe(6000)
    expect(result.autoSavings).toBe(1200) // 6000 * 0.20
  })

  it('uses per-month income snapshots', () => {
    const data: FinanceEngineData = {
      ...baseData,
      incomeSnapshots: [
        { year: 2024, month: 1, amountSnapshot: 7000 },
        { year: 2024, month: 2, amountSnapshot: 5500 },
      ],
    }

    const jan = getMonthlyFinancialSummary(2024, 0, data)
    expect(jan.income).toBe(7000)

    const feb = getMonthlyFinancialSummary(2024, 1, data)
    expect(feb.income).toBe(5500)

    const mar = getMonthlyFinancialSummary(2024, 2, data)
    expect(mar.income).toBe(5000) // falls back to global
  })

  it('uses savings rate snapshots', () => {
    const data: FinanceEngineData = {
      ...baseData,
      savingsSnapshots: [{ year: 2024, month: 1, rateSnapshot: 30 }],
    }

    const result = getMonthlyFinancialSummary(2024, 0, data)
    expect(result.savingsRate).toBe(30)
    expect(result.autoSavings).toBe(1500) // 5000 * 0.30
  })

  it('applies income schedules for future months', () => {
    const now = new Date()
    const schedule: Schedule = {
      type: 'income',
      targetId: null,
      effectiveYear: now.getFullYear(),
      effectiveMonth: now.getMonth() + 1,
      newValue: 8000,
      isActive: 1,
    }

    const data: FinanceEngineData = {
      ...baseData,
      schedules: [schedule],
    }

    const result = getMonthlyFinancialSummary(now.getFullYear(), now.getMonth(), data)
    expect(result.income).toBe(8000)
  })

  it('applies schedules to past months when no snapshot exists', () => {
    const pastYear = 2020
    const schedule: Schedule = {
      type: 'income',
      targetId: null,
      effectiveYear: pastYear,
      effectiveMonth: 1,
      newValue: 9999,
      isActive: 1,
    }

    const data: FinanceEngineData = {
      ...baseData,
      schedules: [schedule],
    }

    const result = getMonthlyFinancialSummary(pastYear, 0, data)
    expect(result.income).toBe(9999) // schedule applied even to past month
  })

  it('ignores archived schedules', () => {
    const schedule: Schedule = {
      type: 'income',
      targetId: null,
      effectiveYear: 2024,
      effectiveMonth: 1,
      newValue: 9999,
      isActive: false,
    }

    const data: FinanceEngineData = {
      ...baseData,
      schedules: [schedule],
    }

    const result = getMonthlyFinancialSummary(2024, 0, data)
    expect(result.income).toBe(5000) // archived schedule ignored
  })

  it('snapshot takes precedence over schedule', () => {
    const schedule: Schedule = {
      type: 'income',
      targetId: null,
      effectiveYear: 2024,
      effectiveMonth: 1,
      newValue: 9999,
      isActive: 1,
    }

    const data: FinanceEngineData = {
      ...baseData,
      schedules: [schedule],
      incomeSnapshots: [{ year: 2024, month: 1, amountSnapshot: 7500 }],
    }

    const result = getMonthlyFinancialSummary(2024, 0, data)
    expect(result.income).toBe(7500) // snapshot wins over schedule
  })

  it('handles zero income', () => {
    const data: FinanceEngineData = {
      ...baseData,
      globalIncome: 0,
    }

    const result = getMonthlyFinancialSummary(2024, 0, data)
    expect(result.income).toBe(0)
    expect(result.autoSavings).toBe(0)
    expect(result.remaining).toBe(0)
  })

  it('does not produce negative autoSavings', () => {
    const data: FinanceEngineData = {
      ...baseData,
      globalIncome: -1000,
    }

    const result = getMonthlyFinancialSummary(2024, 0, data)
    expect(result.autoSavings).toBe(0)
  })

  it('marks archived fixed expenses correctly', () => {
    const data: FinanceEngineData = {
      ...baseData,
      snapshots: [makeSnapshot({ fixedExpenseId: 1, amountSnapshot: 500 })],
      fixedExpenses: [makeFixed({ id: 1, isArchived: true })],
    }

    const result = getMonthlyFinancialSummary(2024, 0, data)
    expect(result.fixedExpenses[0].isArchived).toBe(true)
  })
})

// ── getYearFinancialSummary ─────────────────────────────────────────────────

describe('getYearFinancialSummary', () => {
  it('returns 12 monthly summaries', () => {
    const result = getYearFinancialSummary(2024, baseData, { currentYear: 2024, currentMonth: 0 })
    expect(result.months).toHaveLength(12)
  })

  it('augments snapshots for future months in current year', () => {
    const data: FinanceEngineData = {
      ...baseData,
      fixedExpenses: [makeFixed({ id: 1, amount: 1000 })],
      snapshots: [],
    }

    const result = getYearFinancialSummary(2024, data, { currentYear: 2024, currentMonth: 5 })

    // Past months (0-4) have no fixed expenses
    expect(result.months[0].fixedExpensesTotal).toBe(0)
    expect(result.months[4].fixedExpensesTotal).toBe(0)

    // Current and future months (5-11) get virtual snapshots
    expect(result.months[5].fixedExpensesTotal).toBe(1000)
    expect(result.months[11].fixedExpensesTotal).toBe(1000)
  })

  it('does not duplicate existing snapshots when augmenting', () => {
    const data: FinanceEngineData = {
      ...baseData,
      fixedExpenses: [makeFixed({ id: 1, amount: 1000 })],
      snapshots: [makeSnapshot({ year: 2024, month: 6, amountSnapshot: 900 })],
    }

    const result = getYearFinancialSummary(2024, data, { currentYear: 2024, currentMonth: 5 })
    // June should use the existing snapshot amount, not the default
    expect(result.months[5].fixedExpensesTotal).toBe(900)
  })

  it('excludes archived fixed expenses from augmentation', () => {
    const data: FinanceEngineData = {
      ...baseData,
      fixedExpenses: [makeFixed({ id: 1, amount: 1000, isArchived: true })],
      snapshots: [],
    }

    const result = getYearFinancialSummary(2024, data, { currentYear: 2024, currentMonth: 5 })
    expect(result.months[5].fixedExpensesTotal).toBe(0)
  })

  it('computes year totals correctly', () => {
    const data: FinanceEngineData = {
      ...baseData,
      expenses: [
        makeExpense({ date: '2024-01-15', amount: 100 }),
        makeExpense({ date: '2024-06-20', amount: 200 }),
      ],
      snapshots: [makeSnapshot({ year: 2024, month: 1, amountSnapshot: 500 })],
    }

    const result = getYearFinancialSummary(2024, data, { currentYear: 2024, currentMonth: 0 })

    expect(result.totals.totalIncome).toBe(5000 * 12)
    expect(result.totals.totalVariable).toBe(300)
    expect(result.totals.totalFixed).toBe(500) // only January has fixed
    expect(result.totals.yearTotal).toBe(800) // 500 + 300
  })

  it('computes fixed rows with correct year totals', () => {
    const data: FinanceEngineData = {
      ...baseData,
      snapshots: [
        makeSnapshot({ fixedExpenseId: 1, year: 2024, month: 1, amountSnapshot: 100 }),
        makeSnapshot({ fixedExpenseId: 1, year: 2024, month: 2, amountSnapshot: 200 }),
      ],
      fixedExpenses: [makeFixed({ id: 1 })],
    }

    // currentMonth=1 means months 2-12 get augmented with default amount (1500)
    // yearTotal = 100 (Jan snapshot) + 200 (Feb snapshot) + 1500*10 (Mar-Dec augmented)
    const result = getYearFinancialSummary(2024, data, { currentYear: 2024, currentMonth: 1 })
    expect(result.fixedRows).toHaveLength(1)
    expect(result.fixedRows[0].yearTotal).toBe(100 + 200 + 1500 * 10)
  })

  it('computes monthly savings percentage correctly', () => {
    const data: FinanceEngineData = {
      ...baseData,
      globalIncome: 5000,
      globalSavingsRate: 20,
    }

    const result = getYearFinancialSummary(2024, data, { currentYear: 2024, currentMonth: 0 })
    // autoSavings = 1000, remaining = 4000, total savings = 5000
    // savings % = 5000 / 5000 = 100%
    expect(result.monthlySavingsPct[0]).toBe(100)
  })

  it('returns null savings percentage when income is zero', () => {
    const data: FinanceEngineData = {
      ...baseData,
      globalIncome: 0,
    }

    const result = getYearFinancialSummary(2024, data, { currentYear: 2024, currentMonth: 0 })
    expect(result.monthlySavingsPct[0]).toBeNull()
  })

  it('handles historical years without augmentation', () => {
    const data: FinanceEngineData = {
      ...baseData,
      fixedExpenses: [makeFixed({ id: 1, amount: 1000 })],
      snapshots: [],
    }

    const result = getYearFinancialSummary(2023, data, { currentYear: 2024, currentMonth: 0 })
    // 2023 is historical, no augmentation
    expect(result.months.every((m) => m.fixedExpensesTotal === 0)).toBe(true)
  })

  it('computes average savings percentage across valid months', () => {
    const data: FinanceEngineData = {
      ...baseData,
      incomeSnapshots: [
        { year: 2024, month: 1, amountSnapshot: 5000 },
        { year: 2024, month: 2, amountSnapshot: 0 },
        { year: 2024, month: 3, amountSnapshot: 5000 },
      ],
    }

    const result = getYearFinancialSummary(2024, data, { currentYear: 2024, currentMonth: 0 })
    expect(result.totals.avgSavingsPct).toBeGreaterThan(0)
  })
})

// ── getYearVariableGrid ─────────────────────────────────────────────────────

describe('getYearVariableGrid', () => {
  it('groups expenses by category', () => {
    const expenses: Expense[] = [
      makeExpense({ date: '2024-01-15', amount: 100, categoryId: 1 }),
      makeExpense({ date: '2024-01-20', amount: 50, categoryId: 1 }),
      makeExpense({ date: '2024-01-10', amount: 75, categoryId: 2 }),
    ]
    const categories = [
      { id: 1, name: 'Food', isDeleted: false },
      { id: 2, name: 'Transport', isDeleted: false },
    ]

    const result = getYearVariableGrid(2024, expenses, categories)

    expect(result.variableRows).toHaveLength(2)
    const foodRow = result.variableRows.find((r) => r.key === '1')
    expect(foodRow?.amounts[0]).toBe(150) // January total for Food
    expect(foodRow?.yearTotal).toBe(150)
  })

  it('ignores deleted categories but still shows expenses with that categoryId', () => {
    const expenses: Expense[] = [
      makeExpense({ date: '2024-01-15', amount: 100, categoryId: 1 }),
    ]
    const categories = [
      { id: 1, name: 'Food', isDeleted: true },
    ]

    const result = getYearVariableGrid(2024, expenses, categories)
    // Deleted category is not included in the ordered result list,
    // but expenses with that categoryId still appear in the grid
    // because they fall through to Object.keys(grid)
    const row = result.variableRows.find((r) => r.key === '1')
    expect(row).toBeDefined()
    expect(row!.name).toBe('1') // Falls back to raw key since category is deleted
  })

  it('handles uncategorized expenses', () => {
    const expenses: Expense[] = [
      makeExpense({ date: '2024-01-15', amount: 100, category: 'Misc' }),
    ]

    const result = getYearVariableGrid(2024, expenses, [])
    expect(result.variableRows).toHaveLength(1)
    expect(result.variableRows[0].name).toBe('Misc')
  })

  it('ignores expenses from other years', () => {
    const expenses: Expense[] = [
      makeExpense({ date: '2023-01-15', amount: 100 }),
      makeExpense({ date: '2024-01-15', amount: 200 }),
    ]

    const result = getYearVariableGrid(2024, expenses, [])
    expect(result.yearVariableTotal).toBe(200)
  })

  it('computes max per month correctly', () => {
    const expenses: Expense[] = [
      makeExpense({ date: '2024-01-15', amount: 100, categoryId: 1 }),
      makeExpense({ date: '2024-01-10', amount: 200, categoryId: 2 }),
    ]
    const categories = [
      { id: 1, name: 'Food' },
      { id: 2, name: 'Transport' },
    ]

    const result = getYearVariableGrid(2024, expenses, categories)
    expect(result.maxPerMonth[0]).toBe(200) // January max
    expect(result.maxPerMonth[1]).toBe(0)  // February
  })

  it('computes monthly variable totals', () => {
    const expenses: Expense[] = [
      makeExpense({ date: '2024-01-15', amount: 100 }),
      makeExpense({ date: '2024-01-20', amount: 200 }),
      makeExpense({ date: '2024-02-10', amount: 50 }),
    ]

    const result = getYearVariableGrid(2024, expenses, [])
    expect(result.monthlyVariableTotals[0]).toBe(300)
    expect(result.monthlyVariableTotals[1]).toBe(50)
  })
})

// ── getEditHistoricalDataPreviewTimeline ──────────────────────────────────────────────

describe('getEditHistoricalDataPreviewTimeline', () => {
  it('generates 12 months', () => {
    const result = getEditHistoricalDataPreviewTimeline([], null, null)
    expect(result).toHaveLength(12)
    expect(result[0].month).toBe(1)
    expect(result[11].month).toBe(12)
  })

  it('applies fixed items within their date ranges', () => {
    const items = [
      { name: 'Rent', amount: 1000, startMonth: 1, endMonth: 6 },
      { name: 'Gym', amount: 50, startMonth: 3, endMonth: 12 },
    ]

    const result = getEditHistoricalDataPreviewTimeline(items, null, null)

    expect(result[0].fixedTotal).toBe(1000) // Jan: Rent only
    expect(result[0].fixedItems).toHaveLength(1)

    expect(result[2].fixedTotal).toBe(1050) // Mar: Rent + Gym
    expect(result[2].fixedItems).toHaveLength(2)

    expect(result[6].fixedTotal).toBe(50) // Jul: Gym only
    expect(result[11].fixedTotal).toBe(50) // Dec: Gym only
  })

  it('applies income config across range', () => {
    const incomeConfig = { amount: 5000, startMonth: 1, endMonth: 6 }
    const result = getEditHistoricalDataPreviewTimeline([], incomeConfig, null)

    expect(result[0].income).toBe(5000)
    expect(result[5].income).toBe(5000)
    expect(result[6].income).toBe(0)
    expect(result[11].income).toBe(0)
  })

  it('applies savings rate config across range', () => {
    const savingsConfig = { rate: 20, startMonth: 1, endMonth: 3 }
    const result = getEditHistoricalDataPreviewTimeline([], null, savingsConfig)

    expect(result[0].savingsRate).toBe(20)
    expect(result[2].savingsRate).toBe(20)
    expect(result[3].savingsRate).toBe(0)
  })

  it('computes autoSavings and remaining correctly', () => {
    const items = [{ name: 'Rent', amount: 1000, startMonth: 1, endMonth: 12 }]
    const incomeConfig = { amount: 5000, startMonth: 1, endMonth: 12 }
    const savingsConfig = { rate: 20, startMonth: 1, endMonth: 12 }

    const result = getEditHistoricalDataPreviewTimeline(items, incomeConfig, savingsConfig)

    expect(result[0].autoSavings).toBe(1000) // 5000 * 0.20
    expect(result[0].remaining).toBe(3000) // 5000 - 1000 - 1000
  })

  it('filters out items with empty names', () => {
    const items = [
      { name: '', amount: 100, startMonth: 1, endMonth: 12 },
      { name: 'Valid', amount: 200, startMonth: 1, endMonth: 12 },
    ]

    const result = getEditHistoricalDataPreviewTimeline(items, null, null)
    expect(result[0].fixedItems).toHaveLength(1)
    expect(result[0].fixedItems[0].name).toBe('Valid')
  })

  it('filters out items with NaN amounts', () => {
    const items = [
      { name: 'Bad', amount: NaN, startMonth: 1, endMonth: 12 },
      { name: 'Good', amount: 100, startMonth: 1, endMonth: 12 },
    ]

    const result = getEditHistoricalDataPreviewTimeline(items, null, null)
    expect(result[0].fixedItems).toHaveLength(1)
    expect(result[0].fixedItems[0].name).toBe('Good')
  })

  it('clamps month ranges to 1-12', () => {
    const items = [
      { name: 'Rent', amount: 1000, startMonth: -5, endMonth: 15 },
    ]

    const result = getEditHistoricalDataPreviewTimeline(items, null, null)
    expect(result[0].fixedTotal).toBe(1000) // clamped to 1-12
    expect(result[11].fixedTotal).toBe(1000)
  })

  it('handles null configs gracefully', () => {
    const result = getEditHistoricalDataPreviewTimeline([], null, null)
    expect(result.every((r) => r.income === 0 && r.savingsRate === 0)).toBe(true)
  })

  it('handles zero income correctly', () => {
    const items = [{ name: 'Rent', amount: 1000, startMonth: 1, endMonth: 12 }]
    const result = getEditHistoricalDataPreviewTimeline(items, null, null)
    expect(result[0].autoSavings).toBe(0)
    expect(result[0].remaining).toBe(-1000)
  })
})

// ── MONTHS export ───────────────────────────────────────────────────────────

describe('MONTHS', () => {
  it('has 12 month abbreviations', () => {
    expect(MONTHS).toHaveLength(12)
    expect(MONTHS[0]).toBe('Jan')
    expect(MONTHS[11]).toBe('Dec')
  })
})
