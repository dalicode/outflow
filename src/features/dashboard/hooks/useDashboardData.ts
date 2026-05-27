import { useMemo } from 'react'
import { useFinanceActions, useFinanceData } from '../../../context/financeDataContext'
import type { Expense } from '../../../types'
import { getMonthKeys } from '../utils/dashboardHelpers'
import { getMonthEngineData } from '../../../utils/financeDataHelpers'
import { getMonthlyFinancialSummary } from '../../../utils/financeEngine'

export function useDashboardData(
  expenses: Expense[],
  selectedYear: number,
  selectedMonth: number,
  monthSpan: number,
) {
  const { engineData, incomeAmount, incomeFrequency } = useFinanceData()
  const { forceFinanceDataRefresh } = useFinanceActions()
  const now = useMemo(() => new Date(), [])

  const monthKeys = useMemo(
    () => getMonthKeys(selectedYear, selectedMonth, monthSpan),
    [selectedYear, selectedMonth, monthSpan],
  )

  const monthSummaries = useMemo(
    () =>
      monthKeys.map((mk) => {
        const monthData = getMonthEngineData(
          { ...engineData, expenses },
          mk.year,
          mk.month,
          new Date(),
        )
        return getMonthlyFinancialSummary(mk.year, mk.month, monthData)
      }),
    [monthKeys, engineData, expenses],
  )

  const financialSummary = useMemo(() => {
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const monthData = getMonthEngineData(
      { ...engineData, expenses },
      currentYear,
      currentMonth,
      now,
    )

    return getMonthlyFinancialSummary(currentYear, currentMonth, monthData, {
      currentYear,
      currentMonth,
    })
  }, [engineData, expenses, now])

  const daysLeft = useMemo(() => {
    const today = new Date()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    return Math.max(0, daysInMonth - today.getDate())
  }, [])

  return {
    monthSummaries,
    monthKeys,
    financialSummary,
    daysLeft,
    incomeRaw: incomeAmount,
    incomeFrequency,
    forceFinanceDataRefresh,
  }
}
