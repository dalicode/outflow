import { Suspense, type FormEvent, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import DatePicker from '../../components/inputs/DatePicker'
import MobileEntityPicker from '../../components/inputs/MobileEntityPicker'
import MoneyInput from '../../components/inputs/MoneyInput'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import LazyModalFallback from '../../components/ui/LazyModalFallback'
import { useSettings } from '../../context/settingsContext'
import { useToasts } from '../../context/toastContext'
import { useHaptics } from '../../hooks/useHaptics'
import { useViewportWidth } from '../../hooks/useViewportWidth'
import { useExpenses, usePayees } from '../../hooks/useLocalData'
import { StorageService } from '../../services/storageService'
import { getMostLikelyRelatedEntityId, getRecentEntityIds } from '../../utils/entityHistory'
import type { ComboboxOption } from '../../components/inputs/comboboxUtils'
import { getLocalToday } from '../../utils/historicalDataHelpers'
import { resolveMoneyLocaleConfig } from '../../utils/moneyInput'
import type { MatchConfidence } from '../../utils/payeeMatching'
import { findBestPayeeMatch } from '../../utils/payeeMatching'
import { distributeSplitAmountEvenly, reconcileSplitAmounts } from '../../utils/splitExpenseHelpers'
import './expenses.css'
import type { Category, Expense, ExpenseSplit, Payee } from '../../types'
import DesktopDropdown from '../../components/inputs/DesktopDropdown'
import SingleSelectTrigger from '../../components/inputs/SingleSelectTrigger'

const CategoryModal = lazy(() => import('./CategoryModal'))
const PayeeModal = lazy(() => import('./PayeeModal'))

const EMPTY_FORM = {
  date: getLocalToday(),
  categoryId: '',
  payeeId: '',
  description: '',
  amount: '',
}

function getFormFromExpense(expense: Expense) {
  return {
    date: expense.date,
    categoryId: String(expense.categoryId ?? ''),
    payeeId: String(expense.payeeId ?? ''),
    description: expense.description ?? '',
    amount: String(expense.amount ?? ''),
  }
}

interface SplitChildDraft {
  rowId: string
  expenseId?: number
  categoryId: string
  payeeId: string
  description: string
  amount: string
}

interface ExpenseFormProps {
  onAdd?: (expense: Omit<Expense, 'id'>) => void
  onUpdate?: (id: number, changes: Partial<Expense>) => void
  onSplitSave?: () => void | Promise<void>
  onClose: () => void
  categories: Category[]
  onCategoriesChange?: (
    action: 'add' | 'update' | 'delete' | 'merge',
    payload: { id?: number; name?: string },
  ) => Promise<number | undefined>
  initialExpense?: Expense
  refreshCategories?: () => Promise<void>
  refreshPayees?: () => Promise<void>
  refreshExpenses?: () => Promise<void>
  triggerSync?: () => void
}

export default function ExpenseForm({
  onAdd,
  onUpdate,
  onSplitSave,
  onClose,
  categories,
  onCategoriesChange,
  initialExpense,
  refreshCategories: refreshCategoriesProp,
  refreshPayees: refreshPayeesProp,
  refreshExpenses: refreshExpensesProp,
  triggerSync,
}: ExpenseFormProps) {
  const isEdit = !!initialExpense
  const editingSplitId =
    isEdit && typeof initialExpense?.splitId === 'number' ? initialExpense.splitId : null
  const { expenses } = useExpenses()
  const { payees, refresh: refreshPayees } = usePayees()
  const { settings, formatAmount } = useSettings()
  const { showToast } = useToasts()
  const isMobileViewport = useViewportWidth() < 640
  const decimalPlaces = parseInt(settings.decimalPlaces, 10) || 2
  const moneyConfig = resolveMoneyLocaleConfig(settings.currencySymbol)

  const [form, setForm] = useState(() => {
    if (!isEdit || !initialExpense) return EMPTY_FORM
    const base = getFormFromExpense(initialExpense)
    return {
      ...base,
      amount: initialExpense.amount != null ? initialExpense.amount.toFixed(decimalPlaces) : '',
    }
  })
  const [showCatModal, setShowCatModal] = useState(false)
  const [showPayeeModal, setShowPayeeModal] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showPayeePicker, setShowPayeePicker] = useState(false)
  const [payeeSuggestion, setPayeeSuggestion] = useState<Payee | null>(null)
  const [payeeSuggestionConfidence, setPayeeSuggestionConfidence] =
    useState<MatchConfidence | null>(null)
  const [isSplitMode, setIsSplitMode] = useState(() => editingSplitId != null)
  const [splitChildren, setSplitChildren] = useState<SplitChildDraft[]>([])
  const [showDistributePrompt, setShowDistributePrompt] = useState(false)
  const [isLoadingSplit, setIsLoadingSplit] = useState(false)
  const haptics = useHaptics()

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
      activeCategories.map((c) => ({
        id: c.id,
        label: c.name,
      })),
    [activeCategories],
  )
  const payeeOptions = useMemo<ComboboxOption[]>(
    () => activePayees.map((p) => ({ id: p.id, label: p.name })),
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

  const selectedCategoryName = categoryOptions.find((o) => o.id === Number(form.categoryId))?.label
  const selectedPayeeName = payeeOptions.find((o) => o.id === Number(form.payeeId))?.label
  const canToggleSplitMode = editingSplitId == null
  const splitContainerAmount = Number.parseFloat(form.amount || '0')
  const splitReconciliation = useMemo(
    () =>
      reconcileSplitAmounts(
        splitContainerAmount,
        splitChildren.map((child) => Number.parseFloat(child.amount || '0')),
        decimalPlaces,
      ),
    [decimalPlaces, splitChildren, splitContainerAmount],
  )

  const set =
    <K extends keyof typeof form>(field: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  // Run payee matching when description changes (debounced on blur)
  const runPayeeMatch = useCallback(
    (description: string) => {
      // Don't suggest if payee already selected
      if (form.payeeId) return
      if (!description.trim()) {
        setPayeeSuggestion(null)
        return
      }
      const result = findBestPayeeMatch(description, payees)
      if (!result) {
        setPayeeSuggestion(null)
        return
      }
      setPayeeSuggestion(result.payee)
      setPayeeSuggestionConfidence(result.confidence)
      // Auto-apply only if confidence is "auto"
      if (result.confidence === 'auto') {
        setForm((f) => ({ ...f, payeeId: String(result.payee.id) }))
      }
    },
    [form.payeeId, payees],
  )

  const handleDescriptionBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    runPayeeMatch(e.target.value)
  }

  const acceptSuggestion = () => {
    if (!payeeSuggestion) return
    setForm((f) => ({ ...f, payeeId: String(payeeSuggestion.id) }))
    setPayeeSuggestion(null)
    setPayeeSuggestionConfidence(null)
  }

  const dismissSuggestion = () => {
    setPayeeSuggestion(null)
    setPayeeSuggestionConfidence(null)
  }

  const createSplitChild = useCallback(
    (seed?: Partial<SplitChildDraft>): SplitChildDraft => ({
      rowId: seed?.rowId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      expenseId: seed?.expenseId,
      categoryId: seed?.categoryId ?? '',
      payeeId: seed?.payeeId ?? (form.payeeId || ''),
      description: seed?.description ?? '',
      amount: seed?.amount ?? '0',
    }),
    [form.payeeId],
  )

  const handlePayeeManualSelect = useCallback(
    (id: string | number | undefined) => {
      const nextPayeeId = id != null ? String(id) : ''
      setForm((f) => ({ ...f, payeeId: nextPayeeId }))
      if (isSplitMode) {
        setSplitChildren((children) =>
          children.map((child) => ({
            ...child,
            payeeId: nextPayeeId,
          })),
        )
      }
      setPayeeSuggestion(null)
      setPayeeSuggestionConfidence(null)
      if (id != null) {
        const likelyCategoryId = getMostLikelyRelatedEntityId(
          expenses,
          'payeeId',
          Number(id),
          'categoryId',
          activeCategoryIds,
        )
        if (likelyCategoryId != null) {
          setForm((current) =>
            current.categoryId ? current : { ...current, categoryId: String(likelyCategoryId) },
          )
        }
      }
    },
    [activeCategoryIds, expenses, isSplitMode],
  )

  useEffect(() => {
    if (editingSplitId == null) return
    let isCancelled = false

    const loadSplit = async () => {
      setIsLoadingSplit(true)
      try {
        const [allSplits, children] = await Promise.all([
          StorageService.getAllExpenseSplits(),
          StorageService.getAllSplitChildExpenses(editingSplitId),
        ])
        if (isCancelled) return
        const split = allSplits.find((item) => item.id === editingSplitId)
        if (split) {
          setForm({
            date: split.date,
            categoryId: '',
            payeeId: split.payeeId != null ? String(split.payeeId) : '',
            description: split.description ?? '',
            amount: split.amount.toFixed(decimalPlaces),
          })
        }
        const activeChildren = children.filter((child) => child.deletedAt == null)
        setSplitChildren(
          activeChildren.map((child) => ({
            rowId: `existing-${child.id}-${Math.random().toString(36).slice(2)}`,
            expenseId: child.id,
            categoryId: child.categoryId != null ? String(child.categoryId) : '',
            payeeId: child.payeeId != null ? String(child.payeeId) : '',
            description: child.description ?? '',
            amount: child.amount.toFixed(decimalPlaces),
          })),
        )
      } finally {
        if (!isCancelled) {
          setIsLoadingSplit(false)
        }
      }
    }

    void loadSplit()

    return () => {
      isCancelled = true
    }
  }, [decimalPlaces, editingSplitId])

  useEffect(() => {
    if (!isSplitMode || splitChildren.length > 0) return
    setSplitChildren([createSplitChild()])
  }, [createSplitChild, isSplitMode, splitChildren.length])

  const setSplitChildField = useCallback(
    <K extends keyof SplitChildDraft>(rowId: string, field: K, value: SplitChildDraft[K]) => {
      setSplitChildren((children) =>
        children.map((child) => (child.rowId === rowId ? { ...child, [field]: value } : child)),
      )
    },
    [],
  )

  const addSplitChild = useCallback(() => {
    setSplitChildren((children) => [...children, createSplitChild()])
  }, [createSplitChild])

  const removeSplitChild = useCallback((rowId: string) => {
    setSplitChildren((children) => children.filter((child) => child.rowId !== rowId))
  }, [])

  const applyRemainingToChild = useCallback(
    (rowId: string) => {
      const difference = splitReconciliation.difference
      if (difference === 0) return
      setSplitChildren((children) =>
        children.map((child) => {
          if (child.rowId !== rowId) return child
          const nextAmount = Number.parseFloat(child.amount || '0') + difference
          return {
            ...child,
            amount: nextAmount.toFixed(decimalPlaces),
          }
        }),
      )
    },
    [decimalPlaces, splitReconciliation.difference],
  )

  const getDistributeRows = useCallback((): SplitChildDraft[] => {
    const distributed = distributeSplitAmountEvenly(
      splitContainerAmount,
      splitChildren.length,
      decimalPlaces,
    )
    return splitChildren.map((child, index) => ({
      ...child,
      amount: (distributed[index] ?? 0).toFixed(decimalPlaces),
    }))
  }, [decimalPlaces, splitChildren, splitContainerAmount])

  const getSplitContainerPayload = (): Omit<ExpenseSplit, 'id'> => {
    const resolvedPayeeId = form.payeeId ? Number(form.payeeId) : undefined
    const matchedPayee = payees.find((payee) => payee.id === resolvedPayeeId)
    return {
      date: form.date,
      payeeId: resolvedPayeeId,
      payeeNameSnapshot: matchedPayee?.name ?? null,
      description: form.description,
      amount: splitContainerAmount,
      note: '',
    }
  }

  const saveSplit = async (rows: SplitChildDraft[]) => {
    await StorageService.saveExpenseSplitWithChildren({
      splitId: editingSplitId ?? undefined,
      replaceExpenseId: editingSplitId == null && isEdit ? initialExpense?.id : undefined,
      split: getSplitContainerPayload(),
      children: rows.map((child) => ({
        expenseId: child.expenseId,
        categoryId: child.categoryId ? Number(child.categoryId) : undefined,
        payeeId: child.payeeId ? Number(child.payeeId) : undefined,
        description: child.description,
        amount: Number.parseFloat(child.amount || '0'),
      })),
    })
  }

  const hasSplitRows = (rows: SplitChildDraft[]): boolean => rows.length > 0

  const finalizeSplitSave = async (rows: SplitChildDraft[]) => {
    await saveSplit(rows)
    await refreshExpensesProp?.()
    await onSplitSave?.()
    triggerSync?.()
    haptics.success()
    onClose()
  }

  const trySplitSubmit = async (rows: SplitChildDraft[]) => {
    if (!hasSplitRows(rows)) {
      haptics.error()
      showToast({ message: 'Add at least one split row before saving.', tone: 'danger' })
      return
    }

    const hasMissingCategory = rows.some((row) => !row.categoryId)
    if (hasMissingCategory) {
      haptics.error()
      showToast({ message: 'Select a category for each split row.', tone: 'danger' })
      return
    }

    const splitStatus = reconcileSplitAmounts(
      splitContainerAmount,
      rows.map((child) => Number.parseFloat(child.amount || '0')),
      decimalPlaces,
    )
    if (!splitStatus.isBalanced) {
      setShowDistributePrompt(true)
      return
    }

    await finalizeSplitSave(rows)
  }

  const handleDistributeAndSave = async () => {
    setShowDistributePrompt(false)
    try {
      const distributedRows = getDistributeRows()
      setSplitChildren(distributedRows)
      const distributedStatus = reconcileSplitAmounts(
        splitContainerAmount,
        distributedRows.map((child) => Number.parseFloat(child.amount || '0')),
        decimalPlaces,
      )
      if (!distributedStatus.isBalanced) {
        haptics.error()
        showToast({
          message: 'Could not reconcile split rows after distribution. Please adjust manually.',
          tone: 'danger',
        })
        return
      }
      await finalizeSplitSave(distributedRows)
    } catch (error) {
      haptics.error()
      console.error('Failed to save split transaction after distribution:', error)
      showToast({ message: 'Could not save split transaction.', tone: 'danger' })
    }
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSplitMode) {
      if (!form.amount || Number.isNaN(Number(form.amount)) || Number(form.amount) === 0) {
        haptics.error()
        showToast({ message: 'Amount cannot be zero.', tone: 'danger' })
        return
      }
      try {
        await trySplitSubmit(splitChildren)
      } catch (error) {
        haptics.error()
        console.error('Failed to save split transaction:', error)
        showToast({ message: 'Could not save split transaction.', tone: 'danger' })
      }
      return
    }

    if (!form.categoryId) {
      haptics.error()
      showToast({ message: 'Please select a category.', tone: 'danger' })
      return
    }
    if (!form.amount || Number.isNaN(Number(form.amount)) || Number(form.amount) === 0) {
      haptics.error()
      showToast({ message: 'Amount cannot be zero.', tone: 'danger' })
      return
    }

    const payload = {
      date: form.date,
      categoryId: Number(form.categoryId),
      payeeId: form.payeeId ? Number(form.payeeId) : undefined,
      description: form.description,
      amount: parseFloat(form.amount),
    }

    if (isEdit && initialExpense) {
      haptics.success()
      onUpdate?.(initialExpense.id as number, payload)
      onClose()
      return
    }

    haptics.success()
    onAdd?.(payload)
    setForm(EMPTY_FORM)
  }

  const inputCls = 'input-md w-full'

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={isEdit ? 'Edit Expense' : 'Add Expense'}
        size="md"
        mobileFullScreen
        footer={
          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel-sm hidden flex-1 sm:inline-flex"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="expense-form"
              data-testid="btn-save-expense"
              className="btn-save-expense min-h-12 flex-1 text-base sm:min-h-0 sm:text-[0.8125rem] motion-safe:active:scale-[0.98]"
            >
              {isEdit ? 'Save Changes' : 'Save Expense'}
            </button>
          </ModalFooter>
        }
      >
        <form id="expense-form" onSubmit={submit} className="space-y-4" data-testid="expense-form">
          <div className="flex flex-col gap-1 text-sm text-theme-muted">
            <span>Date</span>
            <DatePicker
              value={form.date}
              variant="inline"
              inputStyle="default"
              onChange={(iso) => setForm((f) => ({ ...f, date: iso }))}
              placeholder="Select date…"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm text-theme-muted">Payee</label>
              <button
                type="button"
                onClick={() => setShowPayeeModal(true)}
                className="text-xs text-theme-primary hover:opacity-80 font-medium"
              >
                + Manage
              </button>
            </div>
            {/* Desktop */}
            <div className="hidden sm:block" data-testid="desktop-payee-dropdown">
              <DesktopDropdown
                value={form.payeeId ? Number(form.payeeId) : undefined}
                options={payeeOptions}
                recentOptions={recentPayeeOptions}
                placeholder="Select payee"
                emptyMessage="No payees found."
                createHint="Type a new payee name to add it."
                allowCreate
                allowClear
                clearLabel="No payee"
                autoFocus={false}
                onChange={handlePayeeManualSelect}
                onCreate={async (name) => {
                  const newId = await StorageService.addPayee(name)
                  await refreshPayees()
                  await refreshPayeesProp?.()
                  return newId
                }}
              />
            </div>
            {/* Mobile */}
            <div className="block sm:hidden" data-testid="mobile-payee-trigger">
              <SingleSelectTrigger
                value={selectedPayeeName}
                placeholder="Select payee"
                isOpen={showPayeePicker}
                onClick={() => setShowPayeePicker(true)}
              />
              <MobileEntityPicker
                open={showPayeePicker}
                title="Choose Payee"
                value={form.payeeId ? Number(form.payeeId) : undefined}
                options={payeeOptions}
                recentOptions={recentPayeeOptions}
                placeholder="Search or add payee"
                emptyMessage="No payees found."
                createHint="Type a new payee name to add it."
                allowCreate
                allowClear
                clearLabel="No payee"
                onChange={handlePayeeManualSelect}
                onCreate={async (name) => {
                  const newId = await StorageService.addPayee(name)
                  await refreshPayees()
                  await refreshPayeesProp?.()
                  return newId
                }}
                onClose={() => setShowPayeePicker(false)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm text-theme-muted">Split Transaction</label>
              <button
                type="button"
                onClick={() => {
                  if (!canToggleSplitMode) return
                  setIsSplitMode((current) => {
                    const next = !current
                    if (next) {
                      setSplitChildren((rows) => (rows.length > 0 ? rows : [createSplitChild()]))
                    }
                    return next
                  })
                }}
                disabled={!canToggleSplitMode}
                data-testid="toggle-split-mode"
                className="rounded-theme-medium border border-theme-border px-3 py-1.5 text-xs font-medium text-theme-text disabled:opacity-50"
              >
                {isSplitMode ? 'Split On' : 'Split Off'}
              </button>
            </div>
          </div>
          {!isSplitMode && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm text-theme-muted">Category</label>
                <button
                  type="button"
                  onClick={() => setShowCatModal(true)}
                  className="text-xs text-theme-primary hover:opacity-80 font-medium"
                >
                  + Manage
                </button>
              </div>
              {/* Desktop */}
              <div className="hidden sm:block" data-testid="desktop-category-dropdown">
                <DesktopDropdown
                  value={form.categoryId ? Number(form.categoryId) : undefined}
                  options={categoryOptions}
                  recentOptions={recentCategoryOptions}
                  placeholder="Select category"
                  emptyMessage="No categories found."
                  createHint="Type a new category name to add it."
                  allowCreate
                  autoFocus={false}
                  onChange={(id) =>
                    setForm((f) => ({
                      ...f,
                      categoryId: id != null ? String(id) : '',
                    }))
                  }
                  onCreate={async (name) => {
                    if (onCategoriesChange) {
                      const newId = await onCategoriesChange('add', { name })
                      await refreshCategoriesProp?.()
                      return newId ?? -1
                    }
                    const newId = await StorageService.addCategory(name)
                    await refreshCategoriesProp?.()
                    return newId
                  }}
                />
              </div>
              {/* Mobile */}
              <div className="block sm:hidden" data-testid="mobile-category-trigger">
                <SingleSelectTrigger
                  value={selectedCategoryName}
                  placeholder="Select category"
                  isOpen={showCategoryPicker}
                  onClick={() => setShowCategoryPicker(true)}
                />
                <MobileEntityPicker
                  open={showCategoryPicker}
                  title="Choose Category"
                  value={form.categoryId ? Number(form.categoryId) : undefined}
                  options={categoryOptions}
                  recentOptions={recentCategoryOptions}
                  placeholder="Search or add category"
                  emptyMessage="No categories found."
                  createHint="Type a new category name to add it."
                  allowCreate
                  onChange={(id) =>
                    setForm((f) => ({
                      ...f,
                      categoryId: id != null ? String(id) : '',
                    }))
                  }
                  onCreate={async (name) => {
                    if (onCategoriesChange) {
                      const newId = await onCategoriesChange('add', { name })
                      await refreshCategoriesProp?.()
                      return newId ?? -1
                    }
                    const newId = await StorageService.addCategory(name)
                    await refreshCategoriesProp?.()
                    return newId
                  }}
                  onClose={() => setShowCategoryPicker(false)}
                />
              </div>
            </div>
          )}
          {isSplitMode && (
            <div className="space-y-3 rounded-theme-large border border-theme-border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-theme-text">Split Rows</div>
                <button
                  type="button"
                  onClick={addSplitChild}
                  className="text-xs font-medium text-theme-primary hover:opacity-80"
                  data-testid="btn-add-split-row"
                >
                  + Add row
                </button>
              </div>
              {isLoadingSplit && (
                <div className="text-xs text-theme-muted" data-testid="split-loading">
                  Loading split rows…
                </div>
              )}
              {splitChildren.map((child, index) => (
                <div
                  key={child.rowId}
                  className="space-y-2 rounded-theme-medium border border-theme-border p-2"
                  data-testid={`split-row-${index}`}
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-theme-muted">
                      Category
                      <select
                        value={child.categoryId}
                        onChange={(event) =>
                          setSplitChildField(child.rowId, 'categoryId', event.target.value)
                        }
                        className={inputCls}
                        aria-label={`Split category ${index + 1}`}
                      >
                        <option value="">Select category</option>
                        {activeCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-theme-muted">
                      Payee
                      <select
                        value={child.payeeId}
                        onChange={(event) =>
                          setSplitChildField(child.rowId, 'payeeId', event.target.value)
                        }
                        className={inputCls}
                        aria-label={`Split payee ${index + 1}`}
                      >
                        <option value="">No payee</option>
                        {activePayees.map((payee) => (
                          <option key={payee.id} value={payee.id}>
                            {payee.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="flex flex-col gap-1 text-xs text-theme-muted">
                      Amount
                      <input
                        type="number"
                        step={10 ** -decimalPlaces}
                        value={child.amount}
                        onChange={(event) =>
                          setSplitChildField(child.rowId, 'amount', event.target.value)
                        }
                        className={inputCls}
                        aria-label={`Split amount ${index + 1}`}
                      />
                    </label>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => applyRemainingToChild(child.rowId)}
                        className="btn-cancel-sm whitespace-nowrap"
                        data-testid={`btn-apply-remaining-${index}`}
                      >
                        Apply remaining
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSplitChild(child.rowId)}
                        disabled={splitChildren.length === 1}
                        className="btn-cancel-sm whitespace-nowrap disabled:opacity-50"
                        data-testid={`btn-remove-split-row-${index}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <label className="flex flex-col gap-1 text-xs text-theme-muted">
                    Description
                    <input
                      type="text"
                      value={child.description}
                      onChange={(event) =>
                        setSplitChildField(child.rowId, 'description', event.target.value)
                      }
                      className={inputCls}
                      placeholder="Optional"
                      aria-label={`Split description ${index + 1}`}
                    />
                  </label>
                </div>
              ))}
              <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2 text-sm">
                {splitReconciliation.isBalanced ? (
                  <span className="font-medium text-theme-success" data-testid="split-balanced">
                    Balanced
                  </span>
                ) : splitReconciliation.difference > 0 ? (
                  <span className="text-theme-muted" data-testid="split-remaining">
                    Remaining: <strong>{formatAmount(splitReconciliation.difference)}</strong>
                  </span>
                ) : (
                  <span className="text-theme-muted" data-testid="split-over">
                    Over by:{' '}
                    <strong>{formatAmount(Math.abs(splitReconciliation.difference))}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1 text-sm text-theme-muted">
            <span>Description</span>
            <input
              type="text"
              value={form.description}
              onChange={set('description')}
              onBlur={handleDescriptionBlur}
              placeholder="Optional"
              className={inputCls}
            />
          </div>

          {/* Payee suggestion banner */}
          {payeeSuggestion && !form.payeeId && payeeSuggestionConfidence === 'confirm' && (
            <div className="flex items-center justify-between gap-2 rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2 text-xs">
              <span className="text-theme-muted">
                Suggested payee:{' '}
                <span className="font-medium text-theme-text">{payeeSuggestion.name}</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={acceptSuggestion}
                  className="font-medium text-theme-primary hover:opacity-80"
                >
                  Use
                </button>
                <button
                  type="button"
                  onClick={dismissSuggestion}
                  className="text-theme-muted hover:text-theme-text"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm text-theme-muted">
            <span>Amount</span>
            <MoneyInput
              value={Number.parseFloat(form.amount || '0')}
              onChange={(amount) =>
                setForm((f) => ({ ...f, amount: amount.toFixed(decimalPlaces) }))
              }
              currency={moneyConfig.currency}
              locale={moneyConfig.locale}
              allowNegative
              showSignToggle
              positiveLabel="Expense"
              negativeLabel="Refund"
              negativeIndicatorLabel="Refund"
              helperText={
                isMobileViewport
                  ? 'Type numbers only - 1234 becomes $12.34'
                  : 'Edit the amount directly, including cents.'
              }
              showCurrencyCode
              autoFocus={!isEdit}
              size="lg"
              entryMode={isMobileViewport ? 'cents' : 'decimal'}
            />
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={showDistributePrompt}
        onClose={() => setShowDistributePrompt(false)}
        title="Split not balanced"
        description={
          splitReconciliation.difference > 0 ? (
            <span>
              You still have <strong>{formatAmount(splitReconciliation.difference)}</strong>{' '}
              remaining. Distribute the container amount across all split rows now?
            </span>
          ) : (
            <span>
              Your split is over by{' '}
              <strong>{formatAmount(Math.abs(splitReconciliation.difference))}</strong>. Distribute
              the container amount across all split rows now?
            </span>
          )
        }
        cancelLabel="Keep editing"
        confirmLabel="Distribute"
        onConfirm={() => {
          void handleDistributeAndSave()
        }}
      />
      {showCatModal && (
        <Suspense
          fallback={
            <LazyModalFallback
              title="Manage Categories"
              message="Loading category manager…"
              onClose={() => setShowCatModal(false)}
            />
          }
        >
          <CategoryModal
            categories={categories}
            onCategoriesChange={onCategoriesChange}
            refreshCategories={refreshCategoriesProp}
            refreshExpenses={refreshExpensesProp}
            onClose={() => setShowCatModal(false)}
          />
        </Suspense>
      )}
      {showPayeeModal && (
        <Suspense
          fallback={
            <LazyModalFallback
              title="Manage Payees"
              message="Loading payee manager…"
              onClose={() => setShowPayeeModal(false)}
            />
          }
        >
          <PayeeModal
            payees={payees}
            onPayeesChange={refreshPayees}
            refreshPayees={refreshPayeesProp}
            refreshExpenses={refreshExpensesProp}
            triggerSync={triggerSync}
            onClose={() => setShowPayeeModal(false)}
          />
        </Suspense>
      )}
    </>
  )
}
