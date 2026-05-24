import { useCallback, useMemo, useState } from 'react'
import type { DashboardView, MonthSpan } from '../constants'
import type { Category, Expense, Payee } from '../../../types'
import { compareExpensesByDateAscThenIdAsc } from '../../../utils/expenseOrdering'
import {
  computeMultiMonthCategoryRows,
  computeMultiMonthFixedRows,
} from '../../../utils/dashboardHelpers'
import { getEffectiveSplitParentExpanded } from '../splitDisplayRows'
import { useDashboardData } from './useDashboardData'
import type { DashboardFiltersState } from './useDashboardFilters'
import { useDashboardFilters } from './useDashboardFilters'
import { useDashboardMonthNav } from './useDashboardMonthNav'
import { useDashboardSelection } from './useDashboardSelection'
import { useDashboardView } from './useDashboardView'
import { useIncomeSavingsModals } from './useIncomeSavingsModals'

export interface DashboardSessionState {
  selectedYear: number
  selectedMonth: number
  monthSpan: MonthSpan
  showGrandTotal: boolean
  viewMode: DashboardView
  filters: DashboardFiltersState
  splitParentExpansionOverrides: Record<number, boolean>
}

export function useDashboard(
  expenses: Expense[],
  categories: Category[],
  payees: Payee[],
  onBulkDelete: (ids: number[]) => void,
  onSelectionChange?: (active: boolean) => void,
  sessionState?: DashboardSessionState,
  onSessionStateChange?: (patch: Partial<DashboardSessionState>) => void,
) {
  const [mobileEditTrigger, setMobileEditTrigger] = useState<number | null>(null)

  const monthNav = useDashboardMonthNav(
    sessionState?.selectedYear,
    sessionState?.selectedMonth,
    sessionState?.monthSpan,
    sessionState?.showGrandTotal,
    (y) => onSessionStateChange?.({ selectedYear: y }),
    (m) => onSessionStateChange?.({ selectedMonth: m }),
    (s) => onSessionStateChange?.({ monthSpan: s }),
    (v) => onSessionStateChange?.({ showGrandTotal: v }),
  )
  const data = useDashboardData(
    expenses,
    monthNav.selectedYear,
    monthNav.selectedMonth,
    monthNav.monthSpan,
  )
  const filters = useDashboardFilters(
    expenses,
    data.monthKeys,
    categories,
    payees,
    sessionState?.filters,
    (patch) =>
      onSessionStateChange?.({
        filters: { ...sessionState?.filters, ...patch } as DashboardFiltersState,
      }),
  )
  const selection = useDashboardSelection(filters.filteredExpenses, onBulkDelete, onSelectionChange)
  const view = useDashboardView(
    onSelectionChange,
    selection.selectedIds,
    sessionState?.viewMode,
    (v) => onSessionStateChange?.({ viewMode: v }),
    monthNav.monthSpan,
  )
  const modals = useIncomeSavingsModals(data.monthSummaries, data.monthKeys)

  const refreshData = useCallback(() => {
    data.forceFinanceDataRefresh()
  }, [data])

  const multiCategoryRows = useMemo(
    () =>
      computeMultiMonthCategoryRows(
        filters.filteredExpenses,
        data.monthKeys,
        filters.getExpenseCategoryName,
      ),
    [filters.filteredExpenses, data.monthKeys, filters.getExpenseCategoryName],
  )

  const multiFixedRows = useMemo(
    () => computeMultiMonthFixedRows(data.monthSummaries),
    [data.monthSummaries],
  )

  const payeeById = useMemo(() => Object.fromEntries(payees.map((p) => [p.id, p])), [payees])

  const getExpensePayeeName = useCallback(
    (exp: Expense) => payeeById[exp.payeeId as number]?.name ?? '—',
    [payeeById],
  )

  const multiPayeeRows = useMemo(
    () =>
      computeMultiMonthCategoryRows(filters.filteredExpenses, data.monthKeys, getExpensePayeeName),
    [filters.filteredExpenses, data.monthKeys, getExpensePayeeName],
  )

  const drilldownExpenses = useMemo(() => {
    if (!view.drilldownCategory) return []
    const mk = data.monthKeys[view.drilldownCategoryMonthIndex]
    if (!mk) return []
    return filters.filteredExpenses
      .filter((e) => {
        const matchesMonth = e.date.startsWith(mk.key)
        const matchesCategory = filters.getExpenseCategoryName(e) === view.drilldownCategory
        return matchesMonth && matchesCategory
      })
      .sort(compareExpensesByDateAscThenIdAsc)
  }, [
    view.drilldownCategory,
    view.drilldownCategoryMonthIndex,
    filters.filteredExpenses,
    data.monthKeys,
    filters.getExpenseCategoryName,
  ])

  const drilldownPayeeExpenses = useMemo(() => {
    if (!view.drilldownPayee) return []
    const mk = data.monthKeys[view.drilldownPayeeMonthIndex]
    if (!mk) return []
    return filters.filteredExpenses
      .filter((e) => {
        const matchesMonth = e.date.startsWith(mk.key)
        const matchesPayee = getExpensePayeeName(e) === view.drilldownPayee
        return matchesMonth && matchesPayee
      })
      .sort(compareExpensesByDateAscThenIdAsc)
  }, [
    view.drilldownPayee,
    view.drilldownPayeeMonthIndex,
    filters.filteredExpenses,
    data.monthKeys,
    getExpensePayeeName,
  ])

  const groupedDrilldownExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {}
    drilldownExpenses.forEach((exp) => {
      if (!groups[exp.date]) groups[exp.date] = []
      groups[exp.date].push(exp)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [drilldownExpenses])

  const spanVariableTotal = useMemo(
    () => data.monthSummaries.reduce((s, m) => s + m.variableExpenses, 0),
    [data.monthSummaries],
  )

  const triggerMobileEdit = useCallback(() => {
    const id = Array.from(selection.selectedIds)[0]
    if (id != null) {
      setMobileEditTrigger(id)
      requestAnimationFrame(() => setMobileEditTrigger(null))
    }
  }, [selection.selectedIds])

  const splitParentDefaultExpanded = monthNav.viewportWidth >= 640
  const [localSplitParentExpansionOverrides, setLocalSplitParentExpansionOverrides] = useState<
    Record<number, boolean>
  >({})
  const splitParentExpansionOverrides =
    sessionState?.splitParentExpansionOverrides ?? localSplitParentExpansionOverrides

  const isSplitParentExpanded = useCallback(
    (splitId: number) =>
      getEffectiveSplitParentExpanded({
        splitId,
        defaultExpanded: splitParentDefaultExpanded,
        overrides: splitParentExpansionOverrides,
      }),
    [splitParentDefaultExpanded, splitParentExpansionOverrides],
  )

  const toggleSplitParentExpanded = useCallback(
    (splitId: number) => {
      const isCurrentlyExpanded = getEffectiveSplitParentExpanded({
        splitId,
        defaultExpanded: splitParentDefaultExpanded,
        overrides: splitParentExpansionOverrides,
      })
      const nextOverrides = {
        ...splitParentExpansionOverrides,
        [splitId]: !isCurrentlyExpanded,
      }
      if (onSessionStateChange) {
        onSessionStateChange({ splitParentExpansionOverrides: nextOverrides })
      } else {
        setLocalSplitParentExpansionOverrides(nextOverrides)
      }
    },
    [onSessionStateChange, splitParentDefaultExpanded, splitParentExpansionOverrides],
  )

  return {
    // Navigation
    ...monthNav,
    // Data
    ...data,
    // Filters
    ...filters,
    // Selection
    ...selection,
    // View
    ...view,
    // Modals
    ...modals,
    // Derived
    multiCategoryRows,
    multiFixedRows,
    multiPayeeRows,
    getExpensePayeeName,
    drilldownExpenses,
    drilldownPayeeExpenses,
    groupedDrilldownExpenses,
    spanVariableTotal,
    isSplitParentExpanded,
    toggleSplitParentExpanded,
    mobileEditTrigger,
    refreshData,
    triggerMobileEdit,
    setMobileEditTrigger,
  }
}
