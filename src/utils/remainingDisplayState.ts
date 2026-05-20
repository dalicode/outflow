import type { MonthlySummary, ThemeConfig } from '../types'
import { getRemainingBarColor } from '../components/ui/BudgetFlowBar'

type RemainingDisplayColors = Pick<ThemeConfig['colors'], 'success' | 'danger' | 'muted'>

export interface RemainingDisplayState {
  remainingBarColor: string
  remainingDisplayColor: string
  isOverBudget: boolean
}

export function getRemainingDisplayState(
  summary: MonthlySummary,
  colors: RemainingDisplayColors,
): RemainingDisplayState {
  const { income, fixedExpensesTotal, autoSavings, remaining } = summary
  const isOverBudget = remaining < 0
  const baselineRemaining = Math.max(0, income - Math.max(0, autoSavings) - fixedExpensesTotal)
  const remainingBarColor = getRemainingBarColor(
    remaining,
    baselineRemaining,
    colors.success,
    colors.danger,
  )

  const remainingDisplayColor = isOverBudget
    ? colors.danger
    : remaining === 0
      ? colors.muted
      : remainingBarColor

  return {
    remainingBarColor,
    remainingDisplayColor,
    isOverBudget,
  }
}
