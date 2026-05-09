import { useCallback, useMemo, useState } from 'react'
import type { Category, Expense, Payee } from '../../../types'

export interface DashboardFiltersState {
  filterGlobal: string
  filterDateFrom: string
  filterDateTo: string
  filterDescription: string
  filterAmount: string
  selectedCategories: string[]
  selectedPayees: string[]
}

export function useDashboardFilters(
  expenses: Expense[],
  monthKeys: Array<{ key: string }>,
  categories: Category[],
  payees: Payee[],
  initialFilters?: DashboardFiltersState,
  onFiltersChange?: (patch: Partial<DashboardFiltersState>) => void,
) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [filterGlobal, setFilterGlobalState] = useState(initialFilters?.filterGlobal ?? '')
  const [filterDateFrom, setFilterDateFromState] = useState(initialFilters?.filterDateFrom ?? '')
  const [filterDateTo, setFilterDateToState] = useState(initialFilters?.filterDateTo ?? '')
  const [filterDescription, setFilterDescriptionState] = useState(
    initialFilters?.filterDescription ?? '',
  )
  const [filterAmount, setFilterAmountState] = useState(initialFilters?.filterAmount ?? '')
  const [selectedCategories, setSelectedCategoriesState] = useState<Set<string>>(
    new Set(initialFilters?.selectedCategories ?? []),
  )
  const [selectedPayees, setSelectedPayeesState] = useState<Set<string>>(
    new Set(initialFilters?.selectedPayees ?? []),
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

  const setFilterDescription = useCallback(
    (v: string) => {
      setFilterDescriptionState(v)
      onFiltersChange?.({ filterDescription: v })
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
        onFiltersChange?.({ selectedCategories: Array.from(next) })
        return next
      })
    },
    [onFiltersChange],
  )

  const setSelectedPayees = useCallback(
    (v: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setSelectedPayeesState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v
        onFiltersChange?.({ selectedPayees: Array.from(next) })
        return next
      })
    },
    [onFiltersChange],
  )

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  )

  const getExpenseCategoryName = (exp: Expense) =>
    categoryById[exp.categoryId as number]?.name ?? 'Uncategorized'

  const payeeById = useMemo(() => Object.fromEntries(payees.map((p) => [p.id, p])), [payees])

  const getExpensePayeeName = (exp: Expense) => payeeById[exp.payeeId as number]?.name ?? '—'

  const expensesInSelectedSpan = useMemo(() => {
    const keys = new Set(monthKeys.map((m) => m.key))
    return expenses
      .filter((e) => keys.has(e.date.slice(0, 7)))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [expenses, monthKeys])

  const filteredExpenses = useMemo(() => {
    let result = expensesInSelectedSpan

    if (selectedCategories.size > 0) {
      result = result.filter((e) => selectedCategories.has(getExpenseCategoryName(e)))
    }

    if (selectedPayees.size > 0) {
      result = result.filter((e) => selectedPayees.has(getExpensePayeeName(e)))
    }

    if (filterGlobal) {
      const q = filterGlobal.toLowerCase()
      result = result.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          getExpenseCategoryName(e).toLowerCase().includes(q) ||
          getExpensePayeeName(e).toLowerCase().includes(q) ||
          String(e.amount).includes(q),
      )
    }

    if (filterDateFrom) {
      result = result.filter((e) => e.date >= filterDateFrom)
    }
    if (filterDateTo) {
      result = result.filter((e) => e.date <= filterDateTo)
    }

    if (filterDescription) {
      const q = filterDescription.toLowerCase()
      result = result.filter((e) => e.description?.toLowerCase().includes(q))
    }

    if (filterAmount) {
      result = result.filter((e) => String(e.amount).includes(filterAmount))
    }

    return result
  }, [
    expensesInSelectedSpan,
    selectedCategories,
    selectedPayees,
    getExpenseCategoryName,
    getExpensePayeeName,
    filterGlobal,
    filterDateFrom,
    filterDateTo,
    filterDescription,
    filterAmount,
  ])

  const activeFilterCount = [
    filterGlobal,
    filterDateFrom,
    filterDateTo,
    selectedCategories.size > 0 ? 'categories' : '',
    selectedPayees.size > 0 ? 'payees' : '',
    filterDescription,
    filterAmount,
  ].filter(Boolean).length

  const clearAllFilters = useCallback(() => {
    setFilterGlobal('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setSelectedCategories(new Set())
    setSelectedPayees(new Set())
    setFilterDescription('')
    setFilterAmount('')
  }, [
    setFilterGlobal,
    setFilterDateFrom,
    setFilterDateTo,
    setSelectedCategories,
    setSelectedPayees,
    setFilterDescription,
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
    filterDescription,
    setFilterDescription,
    filterAmount,
    setFilterAmount,
    selectedCategories,
    setSelectedCategories,
    selectedPayees,
    setSelectedPayees,
    filteredExpenses,
    activeFilterCount,
    clearAllFilters,
    getExpenseCategoryName,
    getExpensePayeeName,
    expensesInSelectedSpan,
  }
}
