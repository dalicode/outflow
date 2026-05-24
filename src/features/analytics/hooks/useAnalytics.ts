import { useCallback, useMemo, useState } from 'react'
import { useFinanceData } from '../../../context/financeDataContext'
import type { AnalyticsData, Category, Expense, Payee } from '../../../types'
import { getExpenseAllocations } from '../../../utils/expenseAllocations'
import { getYearFinancialSummary, getYearVariableGrid } from '../../../utils/financeEngine'

export interface AnalyticsSessionState {
  year: number
  trendKey: string | null
  trendDrilldown: boolean
}

interface UseAnalyticsParams {
  expenses: Expense[]
  categories: Category[]
  sessionState?: AnalyticsSessionState
  onSessionStateChange?: (patch: Partial<AnalyticsSessionState>) => void
}

function makeEmptyAnalyticsData(year: number): AnalyticsData {
  return {
    loading: true,
    year,
    monthlyIncome: Array(12).fill(0),
    variableRows: [],
    payeeRows: [],
    grid: {},
    fixedRows: [],
    monthlyFixedTotals: Array(12).fill(0),
    monthlyVariableTotals: Array(12).fill(0),
    monthlyTotals: Array(12).fill(0),
    monthlySavings: Array(12).fill(null),
    monthlyRemaining: Array(12).fill(null),
    monthlyTotalSavings: Array(12).fill(null),
    monthlySavingsRates: Array(12).fill(0),
    monthlySavingsPct: Array(12).fill(null),
    monthlyHasData: Array(12).fill(false),
    yearVariableTotal: 0,
    yearFixedTotal: 0,
    yearTotal: 0,
    yearSavings: 0,
    yearRemaining: 0,
    yearTotalIncome: 0,
    avgSavingsPct: 0,
    maxPerMonth: Array(12).fill(0),
  }
}

function buildAnalyticsDataForYear(
  year: number,
  expenses: Expense[],
  categories: Category[],
  db: {
    fixedDefs: ReturnType<typeof useFinanceData>['fixedExpenses']
    allFixedSnaps: ReturnType<typeof useFinanceData>['fixedExpenseSnapshots']
    allIncomeSnaps: ReturnType<typeof useFinanceData>['incomeSnapshots']
    allSavingsSnaps: ReturnType<typeof useFinanceData>['savingsSnapshots']
    globalIncome: number
    globalRate: number
    schedules: ReturnType<typeof useFinanceData>['activeSchedules']
    payees: Payee[]
  },
  now: Date,
): AnalyticsData {
  const incomeSnaps = db.allIncomeSnaps.filter((s) => s.year === year)
  const savingsSnaps = db.allSavingsSnaps.filter((s) => s.year === year)
  const fixedSnaps = db.allFixedSnaps.filter((s) => s.year === year)

  const fin = getYearFinancialSummary(
    year,
    {
      expenses,
      snapshots: fixedSnaps,
      fixedExpenses: db.fixedDefs,
      globalIncome: db.globalIncome,
      globalSavingsRate: db.globalRate,
      schedules: db.schedules,
      incomeSnapshots: incomeSnaps,
      savingsSnapshots: savingsSnaps,
    },
    { currentYear: now.getFullYear(), currentMonth: now.getMonth() },
  )

  const vGrid = getYearVariableGrid(year, expenses, categories)

  const payeeById = new Map(db.payees.map((p) => [p.id, p.name]))
  const monthlyAmountsByPayee = new Map<string, number[]>()
  const yearAllocations = getExpenseAllocations(expenses).filter((allocation) =>
    allocation.date?.startsWith(`${year}-`),
  )
  for (const allocation of yearAllocations) {
    const monthIdx = parseInt(allocation.date.slice(5, 7), 10) - 1
    if (monthIdx < 0 || monthIdx > 11) continue
    const name =
      allocation.payeeId != null ? (payeeById.get(allocation.payeeId) ?? 'Unknown') : 'No Payee'
    if (!monthlyAmountsByPayee.has(name)) monthlyAmountsByPayee.set(name, Array(12).fill(0))
    const amounts = monthlyAmountsByPayee.get(name)
    if (amounts) amounts[monthIdx] += allocation.amount
  }
  const payeeRows = Array.from(monthlyAmountsByPayee.entries())
    .map(([name, amounts]) => ({
      key: name,
      name,
      amounts,
      yearTotal: amounts.reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.yearTotal - a.yearTotal)

  const monthlyHasData = Array.from({ length: 12 }, (_, m) => {
    const monthStr = String(m + 1).padStart(2, '0')
    return yearAllocations.some((allocation) => allocation.date?.startsWith(`${year}-${monthStr}`))
  })

  const isCurrentYear = year === now.getFullYear()
  const currentMonthIdx = now.getMonth()
  const monthsToCount = isCurrentYear ? fin.months.slice(0, currentMonthIdx + 1) : fin.months

  return {
    loading: false,
    year,
    monthlyIncome: fin.months.map((m) => m.income),
    variableRows: vGrid.variableRows,
    payeeRows,
    grid: vGrid.grid,
    fixedRows: fin.fixedRows,
    monthlyFixedTotals: fin.monthlyFixedTotals,
    monthlyVariableTotals: fin.monthlyVariableTotals,
    monthlyTotals: fin.monthlyTotals,
    monthlySavings: fin.monthlySavings,
    monthlyRemaining: fin.monthlyRemaining,
    monthlyTotalSavings: fin.monthlyTotalSavings,
    monthlySavingsRates: fin.monthlySavingsRates,
    monthlySavingsPct: fin.monthlySavingsPct,
    monthlyHasData,
    yearVariableTotal: monthsToCount.reduce((s, m) => s + m.variableExpenses, 0),
    yearFixedTotal: monthsToCount.reduce((s, m) => s + m.fixedExpensesTotal, 0),
    yearTotal:
      monthsToCount.reduce((s, m) => s + m.fixedExpensesTotal, 0) +
      monthsToCount.reduce((s, m) => s + m.variableExpenses, 0),
    yearSavings: monthsToCount.reduce((s, m) => s + m.autoSavings, 0),
    yearRemaining: monthsToCount.reduce((s, m) => s + m.remaining, 0),
    yearTotalIncome: monthsToCount.reduce((s, m) => s + m.income, 0),
    avgSavingsPct: fin.totals.avgSavingsPct,
    maxPerMonth: vGrid.maxPerMonth,
  }
}

export function useAnalytics({
  expenses,
  categories,
  sessionState,
  onSessionStateChange,
}: UseAnalyticsParams) {
  const financeData = useFinanceData()
  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const [year, setYearState] = useState(sessionState?.year ?? currentYear)

  const setYear = useCallback(
    (newYear: number | ((prev: number) => number)) => {
      setYearState((prev) => {
        const next = typeof newYear === 'function' ? newYear(prev) : newYear
        onSessionStateChange?.({ year: next, trendKey: null, trendDrilldown: false })
        return next
      })
    },
    [onSessionStateChange],
  )

  const handleYearChange = useCallback(
    (newYear: number) => {
      setYear(newYear)
      onSessionStateChange?.({ year: newYear, trendKey: null, trendDrilldown: false })
    },
    [setYear, onSessionStateChange],
  )

  // Derive the earliest year with expense data
  const earliestYear = useMemo(() => {
    let min = year
    for (const e of expenses) {
      if (e.date) {
        const y = parseInt(e.date.slice(0, 4), 10)
        if (!Number.isNaN(y) && y < min) min = y
      }
    }
    return min
  }, [expenses, year])

  // All years to load: from earliestYear up to the selected year
  const yearsToLoad = useMemo(() => {
    const result: number[] = []
    for (let y = earliestYear; y <= year; y++) result.push(y)
    return result
  }, [earliestYear, year])

  const db = useMemo(
    () => ({
      fixedDefs: financeData.fixedExpenses,
      allFixedSnaps: financeData.fixedExpenseSnapshots,
      allIncomeSnaps: financeData.incomeSnapshots,
      allSavingsSnaps: financeData.savingsSnapshots,
      globalIncome: financeData.engineData.globalIncome,
      globalRate: financeData.engineData.globalSavingsRate,
      schedules: financeData.activeSchedules,
      payees: financeData.payees,
    }),
    [financeData],
  )

  // Compute AnalyticsData for every year in one pass
  const multiYearData = useMemo<AnalyticsData[]>(() => {
    return yearsToLoad.map((y) => buildAnalyticsDataForYear(y, expenses, categories, db, now))
  }, [db, yearsToLoad, expenses, categories, now])

  // The entry for the selected year
  const data = useMemo(
    () => multiYearData.find((d) => d.year === year) ?? makeEmptyAnalyticsData(year),
    [multiYearData, year],
  )

  const lastMonth = year === currentYear ? currentMonth : year < currentYear ? 11 : -1

  return {
    year,
    handleYearChange,
    currentYear,
    currentMonth,
    canGoForward: year < currentYear,
    lastMonth,
    data,
    multiYearData,
    trendKey: sessionState?.trendKey ?? null,
    trendDrilldown: sessionState?.trendDrilldown ?? false,
  }
}
