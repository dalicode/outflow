import { describe, expect, it } from 'vitest'
import type { Expense, MonthlySummary } from '../types'
import {
  computeMultiMonthCategoryRows,
  computeMultiMonthFixedRows,
  getMonthKeys,
} from '../features/dashboard/utils/dashboardHelpers'

describe('getMonthKeys', () => {
  it('returns single month for span=1', () => {
    const result = getMonthKeys(2026, 4, 1) // May 2026
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      year: 2026,
      month: 4,
      key: '2026-05',
      name: 'May',
    })
  })

  it('returns two months going backwards for span=2', () => {
    const result = getMonthKeys(2026, 4, 2) // May 2026, then Apr 2026
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      year: 2026,
      month: 4,
      key: '2026-05',
      name: 'May',
    })
    expect(result[1]).toEqual({
      year: 2026,
      month: 3,
      key: '2026-04',
      name: 'Apr',
    })
  })

  it('handles year rollover correctly', () => {
    const result = getMonthKeys(2026, 0, 2) // Jan 2026, then Dec 2025
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      year: 2026,
      month: 0,
      key: '2026-01',
      name: 'Jan',
    })
    expect(result[1]).toEqual({
      year: 2025,
      month: 11,
      key: '2025-12',
      name: 'Dec',
    })
  })

  it('returns 3 months for span=3', () => {
    const result = getMonthKeys(2026, 1, 3) // Feb 2026, Jan 2026, Dec 2025
    expect(result).toHaveLength(3)
    expect(result[0].key).toBe('2026-02')
    expect(result[1].key).toBe('2026-01')
    expect(result[2].key).toBe('2025-12')
  })

  it('returns 6 months for span=6', () => {
    const result = getMonthKeys(2026, 4, 6) // May 2026 back to Dec 2025
    expect(result).toHaveLength(6)
    expect(result[0].key).toBe('2026-05')
    expect(result[5].key).toBe('2025-12')
  })

  it('returns 12 months for span=12', () => {
    const result = getMonthKeys(2026, 4, 12) // May 2026 back to Jun 2025
    expect(result).toHaveLength(12)
    expect(result[0].key).toBe('2026-05')
    expect(result[11].key).toBe('2025-06')
  })
})

describe('computeMultiMonthCategoryRows', () => {
  const catMap: Record<number, string> = {
    1: 'Food',
    2: 'Transport',
    3: 'A',
    4: 'B',
    5: 'C',
  }
  const resolveName = (exp: Expense) => catMap[exp.categoryId as number] ?? 'Uncategorized'

  it('returns empty array when no expenses', () => {
    const months = getMonthKeys(2026, 4, 2)
    const result = computeMultiMonthCategoryRows([], months, resolveName)
    expect(result).toEqual([])
  })

  it('aggregates single month correctly', () => {
    const expenses: Expense[] = [
      { date: '2026-05-01', amount: 100, categoryId: 1 },
      { date: '2026-05-02', amount: 50, categoryId: 1 },
      { date: '2026-05-03', amount: 30, categoryId: 2 },
    ]
    const months = getMonthKeys(2026, 4, 1)
    const result = computeMultiMonthCategoryRows(expenses, months, resolveName)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: 'Food',
      totalTransactions: 2,
      monthlyAmounts: [150],
    })
    expect(result[1]).toEqual({
      name: 'Transport',
      totalTransactions: 1,
      monthlyAmounts: [30],
    })
  })

  it('sorts by current month amount descending', () => {
    const expenses: Expense[] = [
      { date: '2026-05-01', amount: 10, categoryId: 3 },
      { date: '2026-05-02', amount: 100, categoryId: 4 },
      { date: '2026-05-03', amount: 50, categoryId: 5 },
    ]
    const months = getMonthKeys(2026, 4, 1)
    const result = computeMultiMonthCategoryRows(expenses, months, resolveName)
    expect(result.map((r) => r.name)).toEqual(['B', 'C', 'A'])
  })

  it('includes previous-month-only categories and shows 0 for current', () => {
    const expenses: Expense[] = [
      { date: '2026-05-01', amount: 50, categoryId: 1 },
      { date: '2026-04-15', amount: 30, categoryId: 2 },
    ]
    const months = getMonthKeys(2026, 4, 2)
    const result = computeMultiMonthCategoryRows(expenses, months, resolveName)
    expect(result).toHaveLength(2)
    // Food: current=50, prev=0 → sorted first
    const food = result.find((r) => r.name === 'Food')
    expect(food).toEqual({
      name: 'Food',
      totalTransactions: 1,
      monthlyAmounts: [50, 0],
    })
    // Transport: current=0, prev=30
    const transport = result.find((r) => r.name === 'Transport')
    expect(transport).toEqual({
      name: 'Transport',
      totalTransactions: 1,
      monthlyAmounts: [0, 30],
    })
  })

  it('sums transactions across all months', () => {
    const expenses: Expense[] = [
      { date: '2026-05-01', amount: 100, categoryId: 1 },
      { date: '2026-04-10', amount: 50, categoryId: 1 },
      { date: '2026-04-20', amount: 20, categoryId: 1 },
    ]
    const months = getMonthKeys(2026, 4, 2)
    const result = computeMultiMonthCategoryRows(expenses, months, resolveName)
    expect(result[0].totalTransactions).toBe(3)
    expect(result[0].monthlyAmounts).toEqual([100, 70])
  })
})

describe('computeMultiMonthFixedRows', () => {
  it('returns empty array when no summaries', () => {
    expect(computeMultiMonthFixedRows([])).toEqual([])
  })

  it('aggregates fixed expenses across months', () => {
    const summaries: MonthlySummary[] = [
      {
        income: 5000,
        fixedExpensesTotal: 800,
        savingsRate: 20,
        autoSavings: 1000,
        remaining: 3200,
        variableExpenses: 0,
        fixedExpenses: [{ id: 1, name: 'Rent', amount: 800, isArchived: false }],
      },
      {
        income: 5000,
        fixedExpensesTotal: 800,
        savingsRate: 20,
        autoSavings: 1000,
        remaining: 3200,
        variableExpenses: 0,
        fixedExpenses: [{ id: 1, name: 'Rent', amount: 800, isArchived: false }],
      },
    ]
    const result = computeMultiMonthFixedRows(summaries)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 1,
      name: 'Rent',
      monthlyAmounts: [800, 800],
    })
  })

  it('handles expenses present in one month but not another', () => {
    const summaries: MonthlySummary[] = [
      {
        income: 5000,
        fixedExpensesTotal: 800,
        savingsRate: 20,
        autoSavings: 1000,
        remaining: 3200,
        variableExpenses: 0,
        fixedExpenses: [{ id: 1, name: 'Rent', amount: 800, isArchived: false }],
      },
      {
        income: 5000,
        fixedExpensesTotal: 900,
        savingsRate: 20,
        autoSavings: 1000,
        remaining: 3100,
        variableExpenses: 0,
        fixedExpenses: [
          { id: 1, name: 'Rent', amount: 800, isArchived: false },
          { id: 2, name: 'Internet', amount: 100, isArchived: false },
        ],
      },
    ]
    const result = computeMultiMonthFixedRows(summaries)
    expect(result).toHaveLength(2)
    // Sorted by name
    expect(result[0]).toEqual({
      id: 2,
      name: 'Internet',
      monthlyAmounts: [null, 100],
    })
    expect(result[1]).toEqual({
      id: 1,
      name: 'Rent',
      monthlyAmounts: [800, 800],
    })
  })

  it('returns empty array when no fixed expenses in any month', () => {
    const summaries: MonthlySummary[] = [
      {
        income: 5000,
        fixedExpensesTotal: 0,
        savingsRate: 20,
        autoSavings: 1000,
        remaining: 4000,
        variableExpenses: 0,
        fixedExpenses: [],
      },
    ]
    expect(computeMultiMonthFixedRows(summaries)).toEqual([])
  })
})
