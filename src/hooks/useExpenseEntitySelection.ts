import { useCallback, useMemo, useState } from 'react'
import type { ComboboxOption } from '../components/inputs/comboboxUtils'
import { getMostLikelyRelatedEntityId, getRecentEntityIds } from '../utils/entityHistory'
import { type MatchConfidence, findBestPayeeMatch } from '../utils/payeeMatching'
import type { Category, Expense, Payee } from '../types'

interface UseExpenseEntitySelectionParams {
  categories: Category[]
  payees: Payee[]
  expenses: Pick<Expense, 'date' | 'categoryId' | 'payeeId'>[]
  categoryId: string
  payeeId: string
  onCategoryIdChange: (nextCategoryId: string) => void
  onPayeeIdChange: (nextPayeeId: string) => void
}

interface UseExpenseEntitySelectionResult {
  categoryOptions: ComboboxOption[]
  payeeOptions: ComboboxOption[]
  recentCategoryOptions: ComboboxOption[]
  recentPayeeOptions: ComboboxOption[]
  selectedCategoryName?: string
  selectedPayeeName?: string
  payeeSuggestion: Payee | null
  payeeSuggestionConfidence: MatchConfidence | null
  runPayeeMatch: (notes: string) => void
  handlePayeeManualSelect: (id: string | number | undefined) => void
  acceptSuggestion: () => void
  dismissSuggestion: () => void
  resetSuggestions: () => void
}

export function useExpenseEntitySelection({
  categories,
  payees,
  expenses,
  categoryId,
  payeeId,
  onCategoryIdChange,
  onPayeeIdChange,
}: UseExpenseEntitySelectionParams): UseExpenseEntitySelectionResult {
  const [payeeSuggestion, setPayeeSuggestion] = useState<Payee | null>(null)
  const [payeeSuggestionConfidence, setPayeeSuggestionConfidence] =
    useState<MatchConfidence | null>(null)

  const activeCategories = useMemo(
    () => categories.filter((c): c is Category & { id: number } => !c.isArchived && c.id != null),
    [categories],
  )
  const activePayees = useMemo(
    () =>
      payees
        .filter((p): p is Payee & { id: number } => !p.isArchived && p.id != null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [payees],
  )
  const activeCategoryIds = useMemo(
    () => new Set(activeCategories.map((category) => category.id)),
    [activeCategories],
  )
  const activePayeeIds = useMemo(
    () => new Set(activePayees.map((payee) => payee.id)),
    [activePayees],
  )

  const categoryOptions = useMemo<ComboboxOption[]>(
    () =>
      activeCategories.map((category) => ({
        id: category.id,
        label: category.name,
      })),
    [activeCategories],
  )
  const payeeOptions = useMemo<ComboboxOption[]>(
    () =>
      activePayees.map((payee) => ({
        id: payee.id,
        label: payee.name,
      })),
    [activePayees],
  )

  const recentCategoryOptions = useMemo(() => {
    const recentIds = getRecentEntityIds(expenses, 'categoryId', 5, activeCategoryIds)
    return recentIds
      .map((id) => categoryOptions.find((option) => option.id === id))
      .filter((option): option is ComboboxOption => Boolean(option))
  }, [activeCategoryIds, categoryOptions, expenses])
  const recentPayeeOptions = useMemo(() => {
    const recentIds = getRecentEntityIds(expenses, 'payeeId', 5, activePayeeIds)
    return recentIds
      .map((id) => payeeOptions.find((option) => option.id === id))
      .filter((option): option is ComboboxOption => Boolean(option))
  }, [activePayeeIds, expenses, payeeOptions])

  const selectedCategoryName = categoryOptions.find(
    (option) => option.id === Number(categoryId),
  )?.label
  const selectedPayeeName = payeeOptions.find((option) => option.id === Number(payeeId))?.label

  const resetSuggestions = useCallback(() => {
    setPayeeSuggestion(null)
    setPayeeSuggestionConfidence(null)
  }, [])

  const runPayeeMatch = useCallback(
    (notes: string) => {
      if (payeeId) return
      if (!notes.trim()) {
        resetSuggestions()
        return
      }

      const result = findBestPayeeMatch(notes, payees)
      if (!result) {
        resetSuggestions()
        return
      }

      setPayeeSuggestion(result.payee)
      setPayeeSuggestionConfidence(result.confidence)
      if (result.confidence === 'auto') {
        onPayeeIdChange(String(result.payee.id))
      }
    },
    [onPayeeIdChange, payeeId, payees, resetSuggestions],
  )

  const handlePayeeManualSelect = useCallback(
    (id: string | number | undefined) => {
      const nextPayeeId = id != null ? String(id) : ''
      onPayeeIdChange(nextPayeeId)
      resetSuggestions()

      if (id == null) return

      const likelyCategoryId = getMostLikelyRelatedEntityId(
        expenses,
        'payeeId',
        Number(id),
        'categoryId',
        activeCategoryIds,
      )
      if (likelyCategoryId != null && !categoryId) {
        onCategoryIdChange(String(likelyCategoryId))
      }
    },
    [
      activeCategoryIds,
      categoryId,
      expenses,
      onCategoryIdChange,
      onPayeeIdChange,
      resetSuggestions,
    ],
  )

  const acceptSuggestion = useCallback(() => {
    if (!payeeSuggestion) return
    onPayeeIdChange(String(payeeSuggestion.id))
    resetSuggestions()
  }, [onPayeeIdChange, payeeSuggestion, resetSuggestions])

  const dismissSuggestion = useCallback(() => {
    resetSuggestions()
  }, [resetSuggestions])

  return {
    categoryOptions,
    payeeOptions,
    recentCategoryOptions,
    recentPayeeOptions,
    selectedCategoryName,
    selectedPayeeName,
    payeeSuggestion,
    payeeSuggestionConfidence,
    runPayeeMatch,
    handlePayeeManualSelect,
    acceptSuggestion,
    dismissSuggestion,
    resetSuggestions,
  }
}
