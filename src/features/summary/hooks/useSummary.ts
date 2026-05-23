import { useCallback, useMemo } from 'react'
import { useFinanceActions, useFinanceData } from '../../../context/financeDataContext'
import type { FixedExpense, MonthlySummary } from '../../../types'
import { getMonthEngineData } from '../../../utils/financeDataHelpers'
import { getMonthlyFinancialSummary } from '../../../utils/financeEngine'

interface VariableBreakdownItem {
  name: string
  amount: number
  pct: number
}

export interface UseSummaryState {
  incomeRaw: string
  incomeFreq: string
  monthlyIncome: number
  savingsRate: number
  fixedExpenses: FixedExpense[]
  financialSummary: MonthlySummary | null
  variableBreakdown: VariableBreakdownItem[]
  handleIncomeSave: (input: {
    income: number
    frequency: string
    monthlyIncome: number
  }) => Promise<void>
  handleSavingsRateSave: (rate: number) => Promise<void>
  handleAddFixed: (item: Omit<FixedExpense, 'id'>) => Promise<void>
  handleUpdateFixed: (id: number, changes: Partial<FixedExpense>) => Promise<void>
  handleDeleteFixed: (id: number) => Promise<void>
}

export function useSummary(): UseSummaryState {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const { engineData, activeFixedExpenses, incomeAmount, incomeFrequency, categories, expenses } =
    useFinanceData()
  const {
    saveCurrentIncome,
    saveCurrentSavingsRate,
    addFixedExpense,
    updateFixedExpense,
    removeFixedExpense,
  } = useFinanceActions()

  const financialSummary: MonthlySummary | null = useMemo(() => {
    const monthData = getMonthEngineData(engineData, currentYear, currentMonth, new Date())
    return getMonthlyFinancialSummary(currentYear, currentMonth, monthData)
  }, [currentMonth, currentYear, engineData])

  const variableBreakdown = useMemo<VariableBreakdownItem[]>(() => {
    const monthStr = String(currentMonth + 1).padStart(2, '0')
    const prefix = `${currentYear}-${monthStr}`
    const monthExpenses = expenses.filter((e) => e.date?.startsWith(prefix))

    const byCategory: Record<string, number> = {}
    monthExpenses.forEach((e) => {
      const categoryId = e.categoryId != null ? Number(e.categoryId) : null
      const cat = categoryId != null ? categories.find((c) => c.id === categoryId) : undefined
      const key = cat?.name ?? 'Uncategorized'
      byCategory[key] = (byCategory[key] || 0) + (e.amount || 0)
    })

    const total = Object.values(byCategory).reduce((s, v) => s + v, 0)
    return Object.entries(byCategory)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses, categories, currentYear, currentMonth])

  const handleIncomeSave = useCallback(
    async ({
      income,
      frequency,
      monthlyIncome: monthly,
    }: {
      income: number
      frequency: string
      monthlyIncome: number
    }) => {
      await saveCurrentIncome({ income, frequency, monthlyIncome: monthly })
    },
    [saveCurrentIncome],
  )

  const handleSavingsRateSave = useCallback(
    async (rate: number) => {
      await saveCurrentSavingsRate(rate)
    },
    [saveCurrentSavingsRate],
  )

  const handleAddFixed = useCallback(
    async (item: Omit<FixedExpense, 'id'>) => {
      await addFixedExpense(item)
    },
    [addFixedExpense],
  )

  const handleUpdateFixed = useCallback(
    async (id: number, changes: Partial<FixedExpense>) => {
      await updateFixedExpense(id, changes)
    },
    [updateFixedExpense],
  )

  const handleDeleteFixed = useCallback(
    async (id: number) => {
      await removeFixedExpense(id)
    },
    [removeFixedExpense],
  )

  return {
    incomeRaw: incomeAmount,
    incomeFreq: incomeFrequency,
    monthlyIncome: engineData.globalIncome,
    savingsRate: engineData.globalSavingsRate,
    fixedExpenses: activeFixedExpenses,
    financialSummary,
    variableBreakdown,
    handleIncomeSave,
    handleSavingsRateSave,
    handleAddFixed,
    handleUpdateFixed,
    handleDeleteFixed,
  }
}
