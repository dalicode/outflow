import type { Expense } from '../../../types'
import { parseISODate, toISODate } from '../../../utils/historicalDataHelpers'
import { partsToMonthKey } from '../../../lib/urlParams'

export interface BudgetPaceDailyRow {
  day: number
  date: string
  dailySpent: number | null
  expenseCount: number
  cumulativeSpent: number | null
  idealCumulativeSpend: number | null
  isToday: boolean
  isFutureDay: boolean
}

export interface BudgetPaceSummary {
  selectedMonthKey: string
  selectedYear: number
  selectedMonth: number
  daysInMonth: number
  currentDayForSummary: number
  daysElapsed: number
  daysRemaining: number
  monthlyBudget: number | null
  spentSoFar: number
  budgetRemaining: number | null
  safeDailySpend: number | null
  currentAverageDailySpend: number
  monthElapsedPercent: number
  budgetUsedPercent: number | null
  idealSpendToDate: number | null
  paceDifference: number | null
  status: string
  isMonthComplete: boolean
  dailyRows: BudgetPaceDailyRow[]
}

interface BudgetPaceInput {
  expenses: Expense[]
  selectedYear: number
  selectedMonth: number
  monthlyBudget: number | null
  now?: Date
}

export type ChartDensityMode = 'compact' | 'medium' | 'full'

export function getDayTicks(
  densityMode: ChartDensityMode,
  currentDay: number,
  daysInMonth: number,
): number[] | undefined {
  if (densityMode !== 'compact') return undefined

  const ticks = new Set<number>([1, 14, 21, 28, daysInMonth])
  if (currentDay > 0) ticks.add(currentDay)

  return Array.from(ticks)
    .filter((day) => day >= 1 && day <= daysInMonth)
    .sort((a, b) => a - b)
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatDayLabel(
  day: number,
  densityMode: ChartDensityMode,
  currentDay: number,
  daysInMonth: number,
): string {
  const isLastDay = day === daysInMonth
  const isFirstDay = day === 1

  if (densityMode === 'compact') {
    if (isFirstDay || isLastDay) return String(day)
    if (day === currentDay) return String(day)
    return [14, 21, 28].includes(day) ? String(day) : ''
  }

  if (densityMode === 'medium') {
    if (isFirstDay || isLastDay) return String(day)
    return day % 4 === 0 ? String(day) : ''
  }

  if (isFirstDay || isLastDay || day % 2 === 0) return String(day)
  if (day === currentDay) return String(day)
  return ''
}

function getMonthRelation(
  selectedYear: number,
  selectedMonth: number,
  now: Date,
): 'past' | 'current' | 'future' {
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  if (selectedYear < currentYear) return 'past'
  if (selectedYear > currentYear) return 'future'
  if (selectedMonth < currentMonth) return 'past'
  if (selectedMonth > currentMonth) return 'future'
  return 'current'
}

function getMonthExpenses(
  expenses: Expense[],
  selectedYear: number,
  selectedMonth: number,
): Expense[] {
  const monthKey = partsToMonthKey(selectedYear, selectedMonth)
  return expenses.filter((expense) => expense.date?.startsWith(monthKey))
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function getCurrentDayForSummary(
  selectedYear: number,
  selectedMonth: number,
  now: Date = new Date(),
): number {
  const relation = getMonthRelation(selectedYear, selectedMonth, now)
  if (relation === 'past') {
    return getDaysInMonth(selectedYear, selectedMonth)
  }

  if (relation === 'current') {
    return now.getDate()
  }

  return 0
}

export function getDailySpendingRows(
  expenses: Expense[],
  selectedYear: number,
  selectedMonth: number,
  currentDayForSummary: number,
  daysInMonth: number,
): BudgetPaceDailyRow[] {
  const monthExpenses = getMonthExpenses(expenses, selectedYear, selectedMonth)
  const dayMap = new Map<number, { dailySpent: number; expenseCount: number }>()

  for (const expense of monthExpenses) {
    const parsed = parseISODate(expense.date ?? '')
    if (!parsed) continue
    if (currentDayForSummary > 0 && parsed.day > currentDayForSummary) continue

    const current = dayMap.get(parsed.day) ?? { dailySpent: 0, expenseCount: 0 }
    dayMap.set(parsed.day, {
      dailySpent: roundToCents(current.dailySpent + (expense.amount ?? 0)),
      expenseCount: current.expenseCount + 1,
    })
  }

  const rows: BudgetPaceDailyRow[] = []
  let cumulativeSpent = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = dayMap.get(day) ?? { dailySpent: 0, expenseCount: 0 }
    const isFutureDay = currentDayForSummary > 0 ? day > currentDayForSummary : true
    const dailySpent = isFutureDay ? null : roundToCents(entry.dailySpent)

    if (!isFutureDay) {
      cumulativeSpent = roundToCents(cumulativeSpent + entry.dailySpent)
    }

    rows.push({
      day,
      date: toISODate(selectedYear, selectedMonth + 1, day),
      dailySpent,
      expenseCount: isFutureDay ? 0 : entry.expenseCount,
      cumulativeSpent: isFutureDay ? null : roundToCents(cumulativeSpent),
      idealCumulativeSpend: null,
      isToday: currentDayForSummary > 0 && day === currentDayForSummary,
      isFutureDay,
    })
  }

  return rows
}

export function getBudgetPaceStatus(summary: {
  monthlyBudget: number | null
  spentSoFar: number
  daysElapsed: number
  budgetUsedPercent: number | null
  monthElapsedPercent: number
  isMonthComplete: boolean
}): string {
  if (summary.monthlyBudget == null || summary.monthlyBudget <= 0) {
    return 'No budget set'
  }

  if (summary.isMonthComplete) {
    return 'Month complete'
  }

  if (summary.daysElapsed === 0) {
    return 'No spending yet'
  }

  if (summary.spentSoFar === 0 && summary.daysElapsed > 0) {
    return 'No spending yet'
  }

  if (summary.spentSoFar > summary.monthlyBudget) {
    return 'Over budget'
  }

  const difference = (summary.budgetUsedPercent ?? 0) - summary.monthElapsedPercent
  if (difference <= -0.1) return 'Under budget pace'
  if (difference <= 0.05) return 'On track'
  if (difference <= 0.15) return 'Slightly ahead of pace'
  return 'Spending fast'
}

export function getBudgetPaceSummary({
  expenses,
  selectedYear,
  selectedMonth,
  monthlyBudget,
  now = new Date(),
}: BudgetPaceInput): BudgetPaceSummary {
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth)
  const monthRelation = getMonthRelation(selectedYear, selectedMonth, now)
  const currentDayForSummary = getCurrentDayForSummary(selectedYear, selectedMonth, now)
  const isMonthComplete = monthRelation === 'past'
  const daysElapsed =
    monthRelation === 'past' ? daysInMonth : monthRelation === 'current' ? currentDayForSummary : 0
  const daysRemaining =
    monthRelation === 'past'
      ? 0
      : monthRelation === 'current'
        ? Math.max(0, daysInMonth - currentDayForSummary)
        : daysInMonth
  const monthExpenses = getMonthExpenses(expenses, selectedYear, selectedMonth)

  const spentSoFar = roundToCents(
    monthExpenses.reduce((sum, expense) => {
      const parsed = parseISODate(expense.date ?? '')
      if (!parsed) return sum
      if (monthRelation === 'current' && parsed.day > currentDayForSummary) return sum
      return sum + (expense.amount ?? 0)
    }, 0),
  )

  const hasBudget = monthlyBudget != null && monthlyBudget > 0
  const normalizedBudget = hasBudget ? roundToCents(monthlyBudget ?? 0) : null
  const budgetRemaining = hasBudget ? roundToCents((normalizedBudget ?? 0) - spentSoFar) : null
  const safeDailySpend =
    hasBudget && budgetRemaining != null
      ? roundToCents(daysRemaining > 0 ? budgetRemaining / daysRemaining : budgetRemaining)
      : null
  const currentAverageDailySpend = daysElapsed > 0 ? roundToCents(spentSoFar / daysElapsed) : 0
  const monthElapsedPercent = daysInMonth > 0 ? daysElapsed / daysInMonth : 0
  const budgetUsedPercent =
    hasBudget && normalizedBudget != null ? spentSoFar / normalizedBudget : null
  const idealSpendToDate =
    hasBudget && normalizedBudget != null
      ? roundToCents(normalizedBudget * monthElapsedPercent)
      : null
  const paceDifference =
    idealSpendToDate != null ? roundToCents(spentSoFar - idealSpendToDate) : null

  const dailyRows = getDailySpendingRows(
    expenses,
    selectedYear,
    selectedMonth,
    currentDayForSummary,
    daysInMonth,
  ).map((row) => ({
    ...row,
    idealCumulativeSpend:
      hasBudget && normalizedBudget != null
        ? roundToCents(normalizedBudget * (row.day / daysInMonth))
        : null,
  }))

  return {
    selectedMonthKey: partsToMonthKey(selectedYear, selectedMonth),
    selectedYear,
    selectedMonth,
    daysInMonth,
    currentDayForSummary,
    daysElapsed,
    daysRemaining,
    monthlyBudget: normalizedBudget,
    spentSoFar,
    budgetRemaining,
    safeDailySpend,
    currentAverageDailySpend,
    monthElapsedPercent,
    budgetUsedPercent,
    idealSpendToDate,
    paceDifference,
    status: getBudgetPaceStatus({
      monthlyBudget: normalizedBudget,
      spentSoFar,
      daysElapsed,
      budgetUsedPercent,
      monthElapsedPercent,
      isMonthComplete,
    }),
    isMonthComplete,
    dailyRows,
  }
}
