import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from './authContext'
import { StorageService } from '../services/storageService'
import type { SaveHistoricalSnapshotConfigsParams } from '../services/repositories/historicalSnapshotRepository'
import type {
  Category,
  Expense,
  ExpenseSplit,
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
  expenseSplits: ExpenseSplit[]
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
  const { syncLocalChanges } = useAuth()

  const expenses = useLiveQuery(() => StorageService.getExpenses(), [refreshNonce])
  const categories = useLiveQuery(() => StorageService.getCategories(), [refreshNonce])
  const expenseSplits = useLiveQuery(() => StorageService.getExpenseSplits(), [refreshNonce])
  const payees = useLiveQuery(() => StorageService.getPayees(), [refreshNonce])
  const fixedExpenses = useLiveQuery(() => StorageService.getFixedExpenses(), [refreshNonce])
  const fixedExpenseSnapshots = useLiveQuery(
    () => StorageService.getFixedExpenseSnapshots(),
    [refreshNonce],
  )
  const incomeSnapshots = useLiveQuery(() => StorageService.getIncomeSnapshots(), [refreshNonce])
  const savingsSnapshots = useLiveQuery(() => StorageService.getSavingsSnapshots(), [refreshNonce])
  const schedules = useLiveQuery(() => StorageService.getSchedules(), [refreshNonce])
  const settingsRows = useLiveQuery(() => StorageService.getSettingsRows(), [refreshNonce])

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
    const loadedExpenseSplits = expenseSplits ?? []
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
      expenseSplits: loadedExpenseSplits,
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
        expenseSplits: loadedExpenseSplits,
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
    expenseSplits,
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
        void syncLocalChanges()
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh, syncLocalChanges],
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
        void syncLocalChanges()
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh, syncLocalChanges],
  )

  const addFixedExpense = useCallback(
    async (item: Omit<FixedExpense, 'id'>) => {
      try {
        setActionError(null)
        await StorageService.addFixedExpense(item)
        void syncLocalChanges()
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh, syncLocalChanges],
  )

  const updateFixedExpense = useCallback(
    async (id: number, changes: Partial<FixedExpense>) => {
      try {
        setActionError(null)
        await StorageService.updateFixedExpense(id, changes)
        void syncLocalChanges()
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh, syncLocalChanges],
  )

  const removeFixedExpense = useCallback(
    async (id: number) => {
      try {
        setActionError(null)
        await StorageService.removeFixedExpense(id)
        void syncLocalChanges()
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh, syncLocalChanges],
  )

  const saveIncomeSnapshot = useCallback(
    async (year: number, month: number, amount: number) => {
      try {
        setActionError(null)
        await StorageService.setIncomeSnapshot(year, month, amount)
        void syncLocalChanges()
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh, syncLocalChanges],
  )

  const saveSavingsSnapshot = useCallback(
    async (year: number, month: number, rate: number) => {
      try {
        setActionError(null)
        await StorageService.setSavingsSnapshot(year, month, rate)
        void syncLocalChanges()
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh, syncLocalChanges],
  )

  const saveHistoricalSnapshotConfigs = useCallback(
    async (params: SaveHistoricalSnapshotConfigsParams) => {
      try {
        setActionError(null)
        await StorageService.saveHistoricalSnapshotConfigs(params)
        void syncLocalChanges()
        forceFinanceDataRefresh()
      } catch (error) {
        const nextError = error instanceof Error ? error : new Error(String(error))
        setActionError(nextError)
        throw nextError
      }
    },
    [forceFinanceDataRefresh, syncLocalChanges],
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
        expenseSplits === undefined ||
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
      expenseSplits,
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
