import { describe, expect, it } from 'vitest'
import { THEMES } from '@/utils/themeConfig'
import { getRemainingDisplayState } from '@/utils/remainingDisplayState'
import type { MonthlySummary } from '@/types'

const colors = THEMES.default.colors

function buildSummary(overrides: Partial<MonthlySummary> = {}): MonthlySummary {
  return {
    income: 5000,
    fixedExpensesTotal: 1000,
    savingsRate: 10,
    autoSavings: 500,
    remaining: 2500,
    variableExpenses: 1000,
    fixedExpenses: [],
    ...overrides,
  }
}

describe('getRemainingDisplayState', () => {
  it('returns the success-side color when plenty of budget remains', () => {
    const state = getRemainingDisplayState(buildSummary(), colors)

    expect(state).toEqual({
      remainingBarColor: colors.success,
      remainingDisplayColor: colors.success,
      isOverBudget: false,
    })
  })

  it('returns a warning gradient color when remaining budget is low but still positive', () => {
    const state = getRemainingDisplayState(buildSummary({ remaining: 1000 }), colors)

    expect(state.remainingBarColor).toBe('#CA8A04')
    expect(state.remainingDisplayColor).toBe('#CA8A04')
    expect(state.isOverBudget).toBe(false)
  })

  it('returns a muted display color at exactly zero remaining', () => {
    const state = getRemainingDisplayState(buildSummary({ remaining: 0 }), colors)

    expect(state.remainingBarColor).toBe(colors.danger)
    expect(state.remainingDisplayColor).toBe(colors.muted)
    expect(state.isOverBudget).toBe(false)
  })

  it('returns danger colors when over budget', () => {
    const state = getRemainingDisplayState(buildSummary({ remaining: -200 }), colors)

    expect(state.remainingBarColor).toBe(colors.danger)
    expect(state.remainingDisplayColor).toBe(colors.danger)
    expect(state.isOverBudget).toBe(true)
  })

  it('falls back to danger bar color when the baseline remaining amount is zero', () => {
    const state = getRemainingDisplayState(
      buildSummary({
        income: 1000,
        fixedExpensesTotal: 1000,
        autoSavings: 0,
        remaining: 0,
        variableExpenses: 0,
      }),
      colors,
    )

    expect(state.remainingBarColor).toBe(colors.danger)
    expect(state.remainingDisplayColor).toBe(colors.muted)
    expect(state.isOverBudget).toBe(false)
  })
})
