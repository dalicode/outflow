import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { StorageService } from '../services/storageService'
import type { SaveHistoricalSnapshotConfigsParams } from '../services/repositories/historicalSnapshotRepository'
import type {
  Category,
  Expense,
  FinanceEngineData,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  Payee,
  SavingsSnapshot,
  Schedule,
} from '../types'

interface FinanceDataValue {
  expenses: Expense[]
  categories: Category[]
  payees: Payee[]
  fixedExpenses: FixedExpense[]
  activeFixedExpenses: FixedExpense[]
  fixedExpenseSnapshots: FixedExpenseSnapshot[]
  incomeSnapshots: IncomeSnapshot[]
  savingsSnapshots: SavingsSnapshot[]
  schedules: Schedule[]
  activeSchedules: Schedule[]
  settings: Record<string, unknown>
  incomeAmount: string
  incomeFrequency: string
  engineData: FinanceEngineData
}

interface FinanceActionsValue {
  forceFinanceDataRefresh: () => void
  saveCurrentIncome: (params: {
    income: number
    frequency: string
    monthlyIncome: number
  }) => Promise<void>
  saveCurrentSavingsRate: (rate: number) => Promise<void>
  saveIncomeSnapshot: (year: number, month: number, amount: number) => Promise<void>
  saveSavingsSnapshot: (year: number, month: number, rate: number) => Promise<void>
  saveHistoricalSnapshotConfigs: (params: {
    dirtyYears: Set<number>
    yearConfigs: Record<number, HistoricalYearConfig>
  }) => Promise<void>
  addFixedExpense: (item: Omit<FixedExpense, 'id'>) => Promise<void>
  updateFixedExpense: (id: number, changes: Partial<FixedExpense>) => Promise<void>
  removeFixedExpense: (id: number) => Promise<void>
  saveHistoricalSnapshotConfigs: (params: SaveHistoricalSnapshotConfigsParams) => Promise<void>
}

interface FinanceStatusValue {
  isLoading: boolean
  error: Error | null
}

const FinanceDataContext = createContext<FinanceDataValue | null>(null)
const FinanceActionsContext = createContext<FinanceActionsValue | null>(null)
const FinanceStatusContext = createContext<FinanceStatusValue | null>(null)

export function FinanceDataProvider({ children }: { children: React.ReactNode }) {
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [actionError, setActionError] = useState<Error | null>(null)

  const expenses = useLiveQuery(() => StorageService.db.expenses.toArray(), [refreshNonce])
  const categories = useLiveQuery(() => StorageService.db.categories.toArray(), [refreshNonce])
  const payees = useLiveQuery(() => StorageService.db.payees.toArray(), [refreshNonce])
  const fixedExpenses = useLiveQuery(
    () => StorageService.db.fixedExpenses.toArray(),
    [refreshNonce],
  )
  const fixedExpenseSnapshots = useLiveQuery(
    () => StorageService.db.fixedExpenseSnapshots.toArray(),
    [refreshNonce],
  )
  const incomeSnapshots = useLiveQuery(
    () => StorageService.db.incomeSnapshots.toArray(),
    [refreshNonce],
  )
  const savingsSnapshots = useLiveQuery(
    () => StorageService.db.savingsSnapshots.toArray(),
    [refreshNonce],
  )
  const schedules = useLiveQuery(() => StorageService.db.schedules.toArray(), [refreshNonce])
  const settingsRows = useLiveQuery(() => StorageService.db.settings.toArray(), [refreshNonce])

  const forceFinanceDataRefresh = useCallback(() => {
    setRefreshNonce((prev) => prev + 1)
  }, [])

  const settings = useMemo<Record<string, unknown>>(() => {
    return Object.fromEntries(
      (settingsRows ?? []).map((setting) => [setting.key, setting.value] as const),
    )
  }, [settingsRows])

  const dataValue = useMemo<FinanceDataValue>(() => {
    const loadedExpenses = expenses ?? []
    const loadedCategories = categories ?? []
    const loadedPayees = payees ?? []
    const loadedFixedExpenses = fixedExpenses ?? []
    const loadedFixedExpenseSnapshots = fixedExpenseSnapshots ?? []
    const loadedIncomeSnapshots = incomeSnapshots ?? []
    const loadedSavingsSnapshots = savingsSnapshots ?? []
    const loadedSchedules = schedules ?? []
    const activeSchedules = loadedSchedules.filter((schedule) => schedule.isActive === 1)
    const activeFixedExpenses = loadedFixedExpenses.filter((fixed) => fixed.isArchived !== true)
    const monthlyIncome = Number(settings.monthlyIncome ?? 0)
    const savingsRate = Number(settings.savingsRate ?? 0)

    return {
      expenses: loadedExpenses,
      categories: loadedCategories,
      payees: loadedPayees,
      fixedExpenses: loadedFixedExpenses,
      activeFixedExpenses,
      fixedExpenseSnapshots: loadedFixedExpenseSnapshots,
      incomeSnapshots: loadedIncomeSnapshots,
      savingsSnapshots: loadedSavingsSnapshots,
      schedules: loadedSchedules,
      activeSchedules,
      settings,
      incomeAmount: String(settings.incomeAmount ?? ''),
      incomeFrequency: String(settings.incomeFrequency ?? 'monthly'),
      engineData: {
        expenses: loadedExpenses,
        snapshots: loadedFixedExpenseSnapshots,
        fixedExpenses: loadedFixedExpenses,
        globalIncome: monthlyIncome,
        globalSavingsRate: savingsRate,
        schedules: activeSchedules,
        incomeSnapshots: loadedIncomeSnapshots,
        savingsSnapshots: loadedSavingsSnapshots,
      },
    }
  }, [
    expenses,
    categories,
    payees,
    fixedExpenses,
    fixedExpenseSnapshots,
    incomeSnapshots,
    savingsSnapshots,
    schedules,
    settings,
  ])

  const saveCurrentIncome = useCallback(
    async ({
      income,
      frequency,
      monthlyIncome,
    }: {
      income: number
      frequency: string
      monthlyIncome: number
    }) => {
      const now = new Date()
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      try {
        setActionError(null)
        await Promise.all([
          StorageService.setSetting('incomeAmount', String(income)),
          StorageService.setSetting('incomeFrequency', frequency),
          StorageService.setSetting('monthlyIncome', monthlyIncome),
          StorageService.setSetting('monthlyIncomeUpdatedAt', yearMonth),
        ])
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh],
  )

  const saveCurrentSavingsRate = useCallback(
    async (rate: number) => {
      const now = new Date()
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      try {
        setActionError(null)
        await Promise.all([
          StorageService.setSetting('savingsRate', rate),
          StorageService.setSetting('savingsRateUpdatedAt', yearMonth),
        ])
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh],
  )

  const addFixedExpense = useCallback(
    async (item: Omit<FixedExpense, 'id'>) => {
      try {
        setActionError(null)
        await StorageService.addFixedExpense(item)
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh],
  )

  const updateFixedExpense = useCallback(
    async (id: number, changes: Partial<FixedExpense>) => {
      try {
        setActionError(null)
        await StorageService.updateFixedExpense(id, changes)
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh],
  )

  const removeFixedExpense = useCallback(
    async (id: number) => {
      try {
        setActionError(null)
        await StorageService.removeFixedExpense(id)
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh],
  )

  const saveIncomeSnapshot = useCallback(
    async (year: number, month: number, amount: number) => {
      try {
        setActionError(null)
        await StorageService.setIncomeSnapshot(year, month, amount)
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh],
  )

  const saveSavingsSnapshot = useCallback(
    async (year: number, month: number, rate: number) => {
      try {
        setActionError(null)
        await StorageService.setSavingsSnapshot(year, month, rate)
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh],
  )

  const saveHistoricalSnapshotConfigs = useCallback(
    async (params: SaveHistoricalSnapshotConfigsParams) => {
      try {
        setActionError(null)
        await StorageService.saveHistoricalSnapshotConfigs(params)
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh],
  )

  const actionsValue = useMemo<FinanceActionsValue>(
    () => ({
      forceFinanceDataRefresh,
      saveCurrentIncome,
      saveCurrentSavingsRate,
      saveIncomeSnapshot,
      saveSavingsSnapshot,
      addFixedExpense,
      updateFixedExpense,
      removeFixedExpense,
      saveHistoricalSnapshotConfigs,
    }),
    [
      forceFinanceDataRefresh,
      saveCurrentIncome,
      saveCurrentSavingsRate,
      saveIncomeSnapshot,
      saveSavingsSnapshot,
      addFixedExpense,
      updateFixedExpense,
      removeFixedExpense,
      saveHistoricalSnapshotConfigs,
    ],
  )

  const statusValue = useMemo<FinanceStatusValue>(
    () => ({
      isLoading:
        expenses === undefined ||
        categories === undefined ||
        payees === undefined ||
        fixedExpenses === undefined ||
        fixedExpenseSnapshots === undefined ||
        incomeSnapshots === undefined ||
        savingsSnapshots === undefined ||
        schedules === undefined ||
        settingsRows === undefined,
      error: actionError,
    }),
    [
      expenses,
      categories,
      payees,
      fixedExpenses,
      fixedExpenseSnapshots,
      incomeSnapshots,
      savingsSnapshots,
      schedules,
      settingsRows,
      actionError,
    ],
  )

  return (
    <FinanceStatusContext.Provider value={statusValue}>
      <FinanceActionsContext.Provider value={actionsValue}>
        <FinanceDataContext.Provider value={dataValue}>{children}</FinanceDataContext.Provider>
      </FinanceActionsContext.Provider>
    </FinanceStatusContext.Provider>
  )
}

export function useFinanceData(): FinanceDataValue {
  const context = useContext(FinanceDataContext)
  if (!context) throw new Error('useFinanceData must be used within FinanceDataProvider')
  return context
}

export function useFinanceActions(): FinanceActionsValue {
  const context = useContext(FinanceActionsContext)
  if (!context) throw new Error('useFinanceActions must be used within FinanceDataProvider')
  return context
}

export function useFinanceStatus(): FinanceStatusValue {
  const context = useContext(FinanceStatusContext)
  if (!context) throw new Error('useFinanceStatus must be used within FinanceDataProvider')
  return context
}
