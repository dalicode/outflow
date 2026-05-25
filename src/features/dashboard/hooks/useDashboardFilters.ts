import { useCallback, useMemo, useState } from 'react'
import type { Category, Expense, Payee, Tag } from '../../../types'
import { compareExpensesByDateDescThenIdDesc } from '../../../utils/expenseOrdering'

export interface DashboardFiltersState {
  filterGlobal: string
  filterDateFrom: string
  filterDateTo: string
  filterNotes: string
  filterAmount: string
  selectedCategories: string[]
  selectedPayees: string[]
  selectedTags?: string[]
}

export function useDashboardFilters(
  expenses: Expense[],
  monthKeys: Array<{ key: string }>,
  categories: Category[],
  payees: Payee[],
  expenseTagsMap: Record<number, Tag[]>,
  initialFilters?: DashboardFiltersState,
  onFiltersChange?: (patch: Partial<DashboardFiltersState>) => void,
) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [filterGlobal, setFilterGlobalState] = useState(initialFilters?.filterGlobal ?? '')
  const [filterDateFrom, setFilterDateFromState] = useState(initialFilters?.filterDateFrom ?? '')
  const [filterDateTo, setFilterDateToState] = useState(initialFilters?.filterDateTo ?? '')
  const [filterNotes, setFilterNotesState] = useState(
    initialFilters?.filterNotes ?? '',
  )
  const [filterAmount, setFilterAmountState] = useState(initialFilters?.filterAmount ?? '')
  const [selectedCategories, setSelectedCategoriesState] = useState<Set<string>>(
    new Set(initialFilters?.selectedCategories ?? []),
  )
  const [selectedPayees, setSelectedPayeesState] = useState<Set<string>>(
    new Set(initialFilters?.selectedPayees ?? []),
  )
  const [selectedTags, setSelectedTagsState] = useState<Set<string>>(
    new Set(initialFilters?.selectedTags ?? []),
  )

  // Wrapped setters that also notify the parent
  const setFilterGlobal = useCallback(
    (v: string) => {
      setFilterGlobalState(v)
      onFiltersChange?.({ filterGlobal: v })
    },
    [onFiltersChange],
  )

  const setFilterDateFrom = useCallback(
    (v: string) => {
      setFilterDateFromState(v)
      onFiltersChange?.({ filterDateFrom: v })
    },
    [onFiltersChange],
  )

  const setFilterDateTo = useCallback(
    (v: string) => {
      setFilterDateToState(v)
      onFiltersChange?.({ filterDateTo: v })
    },
    [onFiltersChange],
  )

  const setFilterNotes = useCallback(
    (v: string) => {
      setFilterNotesState(v)
      onFiltersChange?.({ filterNotes: v })
    },
    [onFiltersChange],
  )

  const setFilterAmount = useCallback(
    (v: string) => {
      setFilterAmountState(v)
      onFiltersChange?.({ filterAmount: v })
    },
    [onFiltersChange],
  )

  const setSelectedCategories = useCallback(
    (v: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setSelectedCategoriesState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v
        queueMicrotask(() => {
          onFiltersChange?.({ selectedCategories: Array.from(next) })
        })
        return next
      })
    },
    [onFiltersChange],
  )

  const setSelectedPayees = useCallback(
    (v: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setSelectedPayeesState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v
        queueMicrotask(() => {
          onFiltersChange?.({ selectedPayees: Array.from(next) })
        })
        return next
      })
    },
    [onFiltersChange],
  )
  const setSelectedTags = useCallback(
    (v: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setSelectedTagsState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v
        queueMicrotask(() => {
          onFiltersChange?.({ selectedTags: Array.from(next) })
        })
        return next
      })
    },
    [onFiltersChange],
  )

  const applyDashboardFilters = useCallback(
    (nextFilters: DashboardFiltersState) => {
      setFilterGlobalState(nextFilters.filterGlobal)
      setFilterDateFromState(nextFilters.filterDateFrom)
      setFilterDateToState(nextFilters.filterDateTo)
      setFilterNotesState(nextFilters.filterNotes)
      setFilterAmountState(nextFilters.filterAmount)
      setSelectedCategoriesState(new Set(nextFilters.selectedCategories))
      setSelectedPayeesState(new Set(nextFilters.selectedPayees))
      setSelectedTagsState(new Set(nextFilters.selectedTags ?? []))
      onFiltersChange?.(nextFilters)
    },
    [onFiltersChange],
  )

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  )

  const getExpenseCategoryName = useCallback(
    (exp: Expense) => categoryById[exp.categoryId as number]?.name ?? 'Uncategorized',
    [categoryById],
  )

  const payeeById = useMemo(() => Object.fromEntries(payees.map((p) => [p.id, p])), [payees])

  const getExpensePayeeName = useCallback(
    (exp: Expense) => payeeById[exp.payeeId as number]?.name ?? '—',
    [payeeById],
  )

  const expensesInSelectedSpan = useMemo(() => {
    const keys = new Set(monthKeys.map((m) => m.key))
    return expenses
      .filter((e) => keys.has(e.date.slice(0, 7)))
      .sort(compareExpensesByDateDescThenIdDesc)
  }, [expenses, monthKeys])

  const getExpenseTagNames = useCallback(
    (exp: Expense) => (exp.id != null ? (expenseTagsMap[exp.id] ?? []).map((tag) => tag.name) : []),
    [expenseTagsMap],
  )

  const filteredExpenses = useMemo(() => {
    let result = expensesInSelectedSpan

    if (selectedCategories.size > 0) {
      result = result.filter((e) => selectedCategories.has(getExpenseCategoryName(e)))
    }

    if (selectedPayees.size > 0) {
      result = result.filter((e) => selectedPayees.has(getExpensePayeeName(e)))
    }
    if (selectedTags.size > 0) {
      result = result.filter((e) => getExpenseTagNames(e).some((name) => selectedTags.has(name)))
    }

    if (filterGlobal) {
      const q = filterGlobal.toLowerCase()
      result = result.filter(
        (e) =>
          e.notes?.toLowerCase().includes(q) ||
          getExpenseCategoryName(e).toLowerCase().includes(q) ||
          getExpensePayeeName(e).toLowerCase().includes(q) ||
          getExpenseTagNames(e).some((name) => name.toLowerCase().includes(q)) ||
          String(e.amount).includes(q),
      )
    }

    if (filterDateFrom) {
      result = result.filter((e) => e.date >= filterDateFrom)
    }
    if (filterDateTo) {
      result = result.filter((e) => e.date <= filterDateTo)
    }

    if (filterNotes) {
      const q = filterNotes.toLowerCase()
      result = result.filter((e) => e.notes?.toLowerCase().includes(q))
    }

    if (filterAmount) {
      result = result.filter((e) => String(e.amount).includes(filterAmount))
    }

    return result
  }, [
    expensesInSelectedSpan,
    selectedCategories,
    selectedPayees,
    selectedTags,
    getExpenseCategoryName,
    getExpensePayeeName,
    getExpenseTagNames,
    filterGlobal,
    filterDateFrom,
    filterDateTo,
    filterNotes,
    filterAmount,
  ])

  const activeFilterCount = [
    filterGlobal,
    filterDateFrom,
    filterDateTo,
    selectedCategories.size > 0 ? 'categories' : '',
    selectedPayees.size > 0 ? 'payees' : '',
    selectedTags.size > 0 ? 'tags' : '',
    filterNotes,
    filterAmount,
  ].filter(Boolean).length

  const clearAllFilters = useCallback(() => {
    setFilterGlobal('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setSelectedCategories(new Set())
    setSelectedPayees(new Set())
    setSelectedTags(new Set())
    setFilterNotes('')
    setFilterAmount('')
  }, [
    setFilterGlobal,
    setFilterDateFrom,
    setFilterDateTo,
    setSelectedCategories,
    setSelectedPayees,
    setSelectedTags,
    setFilterNotes,
    setFilterAmount,
  ])

  return {
    isFilterModalOpen,
    setIsFilterModalOpen,
    filterGlobal,
    setFilterGlobal,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    filterNotes,
    setFilterNotes,
    filterAmount,
    setFilterAmount,
    selectedCategories,
    setSelectedCategories,
    selectedPayees,
    setSelectedPayees,
    selectedTags,
    setSelectedTags,
    applyDashboardFilters,
    filteredExpenses,
    activeFilterCount,
    clearAllFilters,
    getExpenseCategoryName,
    getExpensePayeeName,
    getExpenseTagNames,
    expensesInSelectedSpan,
  }
}
