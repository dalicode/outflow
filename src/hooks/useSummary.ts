import { useCallback, useEffect, useMemo, useState } from 'react'
import { StorageService } from '../services/storageService'
import type {
  Category,
  Expense,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  MonthlySummary,
  SavingsSnapshot,
  Schedule,
} from '../types'
import { getMonthlyFinancialSummary } from '../utils/financeEngine'

interface UseSummaryParams {
  expenses: Expense[]
}

interface VariableBreakdownItem {
  name: string
  amount: number
  pct: number
}

export function useSummary({ expenses }: UseSummaryParams) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const [incomeRaw, setIncomeRaw] = useState('')
  const [incomeFreq, setIncomeFreq] = useState('monthly')
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [savingsRate, setSavingsRate] = useState(0)
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [allFixedExpenses, setAllFixedExpenses] = useState<FixedExpense[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [incomeSnapshots, setIncomeSnapshots] = useState<IncomeSnapshot[]>([])
  const [savingsSnapshots, setSavingsSnapshots] = useState<SavingsSnapshot[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    const load = async () => {
      const [
        amt,
        freq,
        monthly,
        rate,
        activeFixed,
        allFixed,
        schedules,
        incomeSnaps,
        savingsSnaps,
        cats,
      ] = await Promise.all([
        StorageService.getSetting('incomeAmount', ''),
        StorageService.getSetting('incomeFrequency', 'monthly'),
        StorageService.getSetting('monthlyIncome', 0),
        StorageService.getSetting('savingsRate', 0),
        StorageService.getActiveFixedExpenses(),
        StorageService.getFixedExpenses(),
        StorageService.getActiveSchedules(),
        StorageService.getIncomeSnapshotsForYear(currentYear),
        StorageService.getSavingsSnapshotsForYear(currentYear),
        StorageService.getCategories(),
      ])

      setIncomeRaw(String((amt as string | null) ?? ''))
      setIncomeFreq(String((freq as string | null) ?? 'monthly'))
      setMonthlyIncome(Number((monthly as number | null) ?? 0))
      setSavingsRate(Number((rate as number | null) ?? 0))
      setFixedExpenses(activeFixed)
      setAllFixedExpenses(allFixed)
      setSchedules(schedules)
      setIncomeSnapshots(incomeSnaps)
      setSavingsSnapshots(savingsSnaps)
      setCategories(cats)
    }
    load()
  }, [currentYear])

  const financialSummary: MonthlySummary | null = useMemo(() => {
    const virtualSnapshots: FixedExpenseSnapshot[] = fixedExpenses.map((f) => ({
      fixedExpenseId: f.id as number,
      year: currentYear,
      month: currentMonth + 1,
      amountSnapshot: f.amount,
      nameSnapshot: f.name,
    }))

    return getMonthlyFinancialSummary(currentYear, currentMonth, {
      expenses,
      snapshots: virtualSnapshots,
      fixedExpenses: allFixedExpenses,
      globalIncome: monthlyIncome,
      globalSavingsRate: savingsRate,
      schedules,
      incomeSnapshots,
      savingsSnapshots,
    })
  }, [
    allFixedExpenses,
    currentMonth,
    currentYear,
    expenses,
    fixedExpenses,
    incomeSnapshots,
    monthlyIncome,
    savingsRate,
    savingsSnapshots,
    schedules,
  ])

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
      const incomeStr = String(income)
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      await Promise.all([
        StorageService.setSetting('incomeAmount', incomeStr),
        StorageService.setSetting('incomeFrequency', frequency),
        StorageService.setSetting('monthlyIncome', monthly),
        StorageService.setSetting('monthlyIncomeUpdatedAt', yearMonth),
      ])
      setIncomeRaw(incomeStr)
      setIncomeFreq(frequency)
      setMonthlyIncome(monthly)
    },
    [now.getFullYear, now.getMonth],
  )

  const handleSavingsRateSave = useCallback(
    async (rate: number) => {
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      await Promise.all([
        StorageService.setSetting('savingsRate', rate),
        StorageService.setSetting('savingsRateUpdatedAt', yearMonth),
      ])
      setSavingsRate(rate)
    },
    [now.getMonth, now.getFullYear],
  )

  const handleAddFixed = useCallback(async (item: Omit<FixedExpense, 'id'>) => {
    await StorageService.addFixedExpense(item)
    const [activeFixed, allFixed] = await Promise.all([
      StorageService.getActiveFixedExpenses(),
      StorageService.getFixedExpenses(),
    ])
    setFixedExpenses(activeFixed)
    setAllFixedExpenses(allFixed)
  }, [])

  const handleUpdateFixed = useCallback(async (id: number, changes: Partial<FixedExpense>) => {
    await StorageService.updateFixedExpense(id, changes)
    const [activeFixed, allFixed] = await Promise.all([
      StorageService.getActiveFixedExpenses(),
      StorageService.getFixedExpenses(),
    ])
    setFixedExpenses(activeFixed)
    setAllFixedExpenses(allFixed)
  }, [])

  const handleDeleteFixed = useCallback(async (id: number) => {
    await StorageService.removeFixedExpense(id)
    const [activeFixed, allFixed] = await Promise.all([
      StorageService.getActiveFixedExpenses(),
      StorageService.getFixedExpenses(),
    ])
    setFixedExpenses(activeFixed)
    setAllFixedExpenses(allFixed)
  }, [])

  return {
    incomeRaw,
    incomeFreq,
    monthlyIncome,
    savingsRate,
    fixedExpenses,
    financialSummary,
    variableBreakdown,
    handleIncomeSave,
    handleSavingsRateSave,
    handleAddFixed,
    handleUpdateFixed,
    handleDeleteFixed,
  }
}
