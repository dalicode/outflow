import { describe, expect, it } from 'vitest'
import type { FinanceEngineData } from '../types'
import { getMonthEngineData } from '../utils/financeDataHelpers'

const baseEngineData: FinanceEngineData = {
  expenses: [],
  snapshots: [
    {
      fixedExpenseId: 1,
      nameSnapshot: 'Rent',
      amountSnapshot: 1000,
      year: 2025,
      month: 2,
    },
    {
      fixedExpenseId: 1,
      nameSnapshot: 'Rent',
      amountSnapshot: 1100,
      year: 2026,
      month: 1,
    },
  ],
  fixedExpenses: [
    { id: 1, name: 'Rent', amount: 1200 },
    { id: 2, name: 'Gym', amount: 50, isArchived: true },
  ],
  globalIncome: 5000,
  globalSavingsRate: 20,
  schedules: [],
  incomeSnapshots: [
    { year: 2025, month: 2, amountSnapshot: 4100 },
    { year: 2026, month: 1, amountSnapshot: 5000 },
  ],
  savingsSnapshots: [
    { year: 2025, month: 2, rateSnapshot: 15 },
    { year: 2026, month: 1, rateSnapshot: 20 },
  ],
}

describe('getMonthEngineData', () => {
  it('uses historical fixed-expense snapshots for past months', () => {
    const result = getMonthEngineData(baseEngineData, 2025, 1, new Date('2026-01-15'))

    expect(result.snapshots).toEqual([
      {
        fixedExpenseId: 1,
        nameSnapshot: 'Rent',
        amountSnapshot: 1000,
        year: 2025,
        month: 2,
      },
    ])
    expect(result.incomeSnapshots).toEqual([{ year: 2025, month: 2, amountSnapshot: 4100 }])
    expect(result.savingsSnapshots).toEqual([{ year: 2025, month: 2, rateSnapshot: 15 }])
  })

  it('uses active fixed-expense definitions for current/future months', () => {
    const result = getMonthEngineData(baseEngineData, 2026, 0, new Date('2026-01-15'))

    expect(result.snapshots).toEqual([
      {
        fixedExpenseId: 1,
        nameSnapshot: 'Rent',
        amountSnapshot: 1200,
        year: 2026,
        month: 1,
      },
    ])
  })
})
