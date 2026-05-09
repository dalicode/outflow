import { useEffect, useMemo, useState } from 'react'
import { StorageService } from '../services/storageService'
import type { Expense, MonthlySummary } from '../types'
import { getMonthKeys } from '../utils/dashboardHelpers'
import { getMonthlyFinancialSummary } from '../utils/financeEngine'

export function useDashboardData(
  expenses: Expense[],
  selectedYear: number,
  selectedMonth: number,
  monthSpan: number,
  _dataRefreshKey: number,
) {
  const [monthSummaries, setMonthSummaries] = useState<MonthlySummary[]>([])
  const [financialSummary, setFinancialSummary] = useState<MonthlySummary | null>(null)
  const [incomeRaw, setIncomeRaw] = useState('')
  const [incomeFrequency, setIncomeFrequency] = useState('monthly')

  const monthKeys = useMemo(
    () => getMonthKeys(selectedYear, selectedMonth, monthSpan),
    [selectedYear, selectedMonth, monthSpan],
  )

  // Load data for the selected month span
  useEffect(() => {
    const loadData = async () => {
      const now = new Date()
      const neededYears = Array.from(new Set(monthKeys.map((m) => m.year)))

      const [allFixed, globalIncome, globalRate, schedules, incomeAmount, incomeFreq] =
        await Promise.all([
          StorageService.getFixedExpenses(),
          StorageService.getSetting('monthlyIncome', 0),
          StorageService.getSetting('savingsRate', 0),
          StorageService.getActiveSchedules(),
          StorageService.getSetting('incomeAmount', ''),
          StorageService.getSetting('incomeFrequency', 'monthly'),
        ])

      setIncomeRaw(incomeAmount as string)
      setIncomeFrequency(incomeFreq as string)

      const allSnapshotsByYear: Record<
        number,
        Awaited<ReturnType<typeof StorageService.getSnapshotsForYear>>
      > = {}
      const incomeSnapsByYear: Record<
        number,
        Awaited<ReturnType<typeof StorageService.getIncomeSnapshotsForYear>>
      > = {}
      const savingsSnapsByYear: Record<
        number,
        Awaited<ReturnType<typeof StorageService.getSavingsSnapshotsForYear>>
      > = {}

      await Promise.all(
        neededYears.map(async (year) => {
          const [snaps, incSnaps, savSnaps] = await Promise.all([
            StorageService.getSnapshotsForYear(year),
            StorageService.getIncomeSnapshotsForYear(year),
            StorageService.getSavingsSnapshotsForYear(year),
          ])
          allSnapshotsByYear[year] = snaps
          incomeSnapsByYear[year] = incSnaps
          savingsSnapsByYear[year] = savSnaps
        }),
      )

      const summaries: MonthlySummary[] = monthKeys.map((mk) => {
        const isCurrentOrFuture =
          mk.year > now.getFullYear() ||
          (mk.year === now.getFullYear() && mk.month >= now.getMonth())

        const allSnapshots = allSnapshotsByYear[mk.year] || []
        let monthSnapshots: {
          fixedExpenseId: number
          year: number
          month: number
          amountSnapshot: number
          nameSnapshot: string
        }[]
        if (isCurrentOrFuture) {
          const active = allFixed.filter((f) => f.isArchived !== true)
          monthSnapshots = active.map((f) => ({
            fixedExpenseId: f.id as number,
            year: mk.year,
            month: mk.month + 1,
            amountSnapshot: f.amount,
            nameSnapshot: f.name,
          }))
        } else {
          monthSnapshots = allSnapshots.filter((s) => s.month === mk.month + 1)
        }

        const data = {
          expenses,
          snapshots: monthSnapshots,
          fixedExpenses: allFixed,
          globalIncome: globalIncome as number,
          globalSavingsRate: globalRate as number,
          schedules,
          incomeSnapshots: incomeSnapsByYear[mk.year] || [],
          savingsSnapshots: savingsSnapsByYear[mk.year] || [],
        }

        return getMonthlyFinancialSummary(mk.year, mk.month, data)
      })

      setMonthSummaries(summaries)
    }
    loadData()
  }, [expenses, monthKeys])

  // Always load current month summary for the header
  useEffect(() => {
    const loadCurrentMonthSummary = async () => {
      const today = new Date()
      const currentYear = today.getFullYear()
      const currentMonth = today.getMonth()

      const [allFixed, globalIncome, globalRate, schedules] = await Promise.all([
        StorageService.getFixedExpenses(),
        StorageService.getSetting('monthlyIncome', 0),
        StorageService.getSetting('savingsRate', 0),
        StorageService.getActiveSchedules(),
      ])

      const [snaps, incSnaps, savSnaps] = await Promise.all([
        StorageService.getSnapshotsForYear(currentYear),
        StorageService.getIncomeSnapshotsForYear(currentYear),
        StorageService.getSavingsSnapshotsForYear(currentYear),
      ])

      const monthSnapshots = snaps.filter((s) => s.month === currentMonth + 1)

      const data = {
        expenses,
        snapshots: monthSnapshots,
        fixedExpenses: allFixed,
        globalIncome: globalIncome as number,
        globalSavingsRate: globalRate as number,
        schedules,
        incomeSnapshots: incSnaps,
        savingsSnapshots: savSnaps,
      }

      const summary = getMonthlyFinancialSummary(currentYear, currentMonth, data, {
        currentYear,
        currentMonth,
      })
      setFinancialSummary(summary)
    }
    loadCurrentMonthSummary()
  }, [expenses])

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
    incomeRaw,
    incomeFrequency,
  }
}
