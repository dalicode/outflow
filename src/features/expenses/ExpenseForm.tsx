import { Suspense, type FormEvent, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import DatePicker from '../../components/inputs/DatePicker'
import MobileEntityPicker from '../../components/inputs/MobileEntityPicker'
import MoneyInput from '../../components/inputs/MoneyInput'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import LazyModalFallback from '../../components/ui/LazyModalFallback'
import ExpenseEntityFields from '../../components/expense/ExpenseEntityFields'
import PayeeSuggestionBanner from '../../components/expense/PayeeSuggestionBanner'
import { useSettings } from '../../context/settingsContext'
import { useToasts } from '../../context/toastContext'
import { useExpenseEntitySelection } from '../../hooks/useExpenseEntitySelection'
import { useHaptics } from '../../hooks/useHaptics'
import { useViewportWidth } from '../../hooks/useViewportWidth'
import { useExpenses, usePayees, useTags } from '../../hooks/useLocalData'
import { StorageService } from '../../services/storageService'
import { getLocalToday } from '../../utils/historicalDataHelpers'
import { resolveMoneyLocaleConfig } from '../../utils/moneyInput'
import { distributeSplitAmountEvenly, reconcileSplitAmounts } from '../../utils/splitExpenseHelpers'
import { cn } from '../../utils/cn'
import './expenses.css'
import type { Category, Expense, ExpenseSplit } from '../../types'
import DesktopDropdown from '../../components/inputs/DesktopDropdown'
import SingleSelectTrigger from '../../components/inputs/SingleSelectTrigger'
import TagMultiSelect from '../../components/inputs/TagMultiSelect'

const CategoryModal = lazy(() => import('./CategoryModal'))
const PayeeModal = lazy(() => import('./PayeeModal'))

const EMPTY_FORM = {
  date: getLocalToday(),
  categoryId: '',
  payeeId: '',
  notes: '',
  amount: '',
}

function getFormFromExpense(expense: Expense) {
  return {
    date: expense.date,
    categoryId: String(expense.categoryId ?? ''),
    payeeId: String(expense.payeeId ?? ''),
    notes: expense.notes ?? '',
    amount: String(expense.amount ?? ''),
  }
}

interface SplitChildDraft {
  rowId: string
  expenseId?: number
  categoryId: string
  notes: string
  amount: string
}

interface ExpenseFormProps {
  onAdd?: (expense: Omit<Expense, 'id'>) => Promise<number | void> | number | void
  onUpdate?: (id: number, changes: Partial<Expense>) => Promise<void> | void
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
  const { tags, refresh: refreshTags } = useTags()
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
  const [openSplitCategoryPickers, setOpenSplitCategoryPickers] = useState<Record<string, boolean>>(
    {},
  )
  const [isSplitMode, setIsSplitMode] = useState(() => editingSplitId != null)
  const [splitChildren, setSplitChildren] = useState<SplitChildDraft[]>([])
  const [showDistributePrompt, setShowDistributePrompt] = useState(false)
  const [isLoadingSplit, setIsLoadingSplit] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const haptics = useHaptics()

  const {
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
  } = useExpenseEntitySelection({
    categories,
    payees,
    expenses,
    categoryId: form.categoryId,
    payeeId: form.payeeId,
    onCategoryIdChange: (nextCategoryId) =>
      setForm((current) => ({ ...current, categoryId: nextCategoryId })),
    onPayeeIdChange: (nextPayeeId) => setForm((current) => ({ ...current, payeeId: nextPayeeId })),
  })

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

  const createCategory = useCallback(
    async (name: string) => {
      if (onCategoriesChange) {
        const newId = await onCategoriesChange('add', { name })
        await refreshCategoriesProp?.()
        return newId ?? -1
      }
      const newId = await StorageService.addCategory(name)
      await refreshCategoriesProp?.()
      return newId
    },
    [onCategoriesChange, refreshCategoriesProp],
  )

  const createSplitChild = useCallback(
    (seed?: Partial<SplitChildDraft>): SplitChildDraft => ({
      rowId: seed?.rowId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      expenseId: seed?.expenseId,
      categoryId: seed?.categoryId ?? '',
      notes: seed?.notes ?? '',
      amount: seed?.amount ?? '0',
    }),
    [],
  )

  const toggleSplitMode = useCallback(() => {
    if (!canToggleSplitMode) return
    setIsSplitMode((current) => {
      const next = !current
      if (next) {
        setSplitChildren((rows) => (rows.length > 0 ? rows : [createSplitChild()]))
      }
      return next
    })
  }, [canToggleSplitMode, createSplitChild])

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
            notes: split.notes ?? '',
            amount: split.amount.toFixed(decimalPlaces),
          })
        }
        const activeChildren = children.filter((child) => child.deletedAt == null)
        setSplitChildren(
          activeChildren.map((child) => ({
            rowId: `existing-${child.id}-${Math.random().toString(36).slice(2)}`,
            expenseId: child.id,
            categoryId: child.categoryId != null ? String(child.categoryId) : '',
            notes: child.notes ?? '',
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
    let isCancelled = false
    const load = async () => {
      if (!isEdit || !initialExpense?.id) {
        setSelectedTagIds([])
        return
      }
      if (typeof StorageService.getTagIdsForExpense !== 'function') {
        setSelectedTagIds([])
        return
      }
      const ids = await StorageService.getTagIdsForExpense(initialExpense.id)
      if (!isCancelled) setSelectedTagIds(ids)
    }
    void load()
    return () => {
      isCancelled = true
    }
  }, [initialExpense?.id, isEdit])

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
    setOpenSplitCategoryPickers((prev) => {
      if (!(rowId in prev)) return prev
      const next = { ...prev }
      delete next[rowId]
      return next
    })
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
      notes: form.notes,
      amount: splitContainerAmount,
    }
  }

  const saveSplit = async (rows: SplitChildDraft[]) => {
    const inheritedPayeeId = form.payeeId ? Number(form.payeeId) : undefined
    return StorageService.saveExpenseSplitWithChildren({
      splitId: editingSplitId ?? undefined,
      replaceExpenseId: editingSplitId == null && isEdit ? initialExpense?.id : undefined,
      split: getSplitContainerPayload(),
      children: rows.map((child) => ({
        expenseId: child.expenseId,
        categoryId: child.categoryId ? Number(child.categoryId) : undefined,
        payeeId: inheritedPayeeId,
        notes: child.notes,
        amount: Number.parseFloat(child.amount || '0'),
      })),
    })
  }

  const hasSplitRows = (rows: SplitChildDraft[]): boolean => rows.length > 0

  const finalizeSplitSave = async (rows: SplitChildDraft[]) => {
    const splitId = await saveSplit(rows)
    const splitChildren =
      typeof StorageService.getSplitChildExpenses === 'function'
        ? await StorageService.getSplitChildExpenses(splitId)
        : []
    const childIds = splitChildren
      .map((row) => row.id)
      .filter((id): id is number => typeof id === 'number')
    try {
      if (typeof StorageService.setTagsForExpenses === 'function') {
        await StorageService.setTagsForExpenses(childIds, selectedTagIds)
      }
    } catch {
      showToast({ message: 'Could not save tags for split transaction.', tone: 'danger' })
      return
    }
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
      notes: form.notes,
      amount: parseFloat(form.amount),
    }

    if (isEdit && initialExpense) {
      await onUpdate?.(initialExpense.id as number, payload)
      try {
        if (typeof StorageService.setExpenseTags === 'function') {
          await StorageService.setExpenseTags(initialExpense.id as number, selectedTagIds)
        }
      } catch {
        haptics.error()
        showToast({ message: 'Could not save tags for expense.', tone: 'danger' })
        return
      }
      triggerSync?.()
      haptics.success()
      onClose()
      return
    }

    const newId = await onAdd?.(payload)
    if (typeof newId === 'number') {
      try {
        if (typeof StorageService.setExpenseTags === 'function') {
          await StorageService.setExpenseTags(newId, selectedTagIds)
        }
      } catch {
        haptics.error()
        showToast({ message: 'Could not save tags for expense.', tone: 'danger' })
        return
      }
      triggerSync?.()
    }
    haptics.success()
    setForm(EMPTY_FORM)
    setSelectedTagIds([])
  }

  const inputCls = 'input-md w-full'
  const splitPayeeInheritanceLabel = selectedPayeeName ?? 'No payee'
  const amountField = (
    <div
      className={cn(
        'flex flex-col gap-2 text-sm text-theme-muted',
        'mx-auto w-full max-w-[16rem] items-center text-center',
      )}
    >
      <span>{isSplitMode ? 'Total Amount' : 'Amount'}</span>
      <MoneyInput
        value={Number.parseFloat(form.amount || '0')}
        onChange={(amount) => setForm((f) => ({ ...f, amount: amount.toFixed(decimalPlaces) }))}
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
        autoFocus
        size="lg"
        entryMode={isMobileViewport ? 'cents' : 'decimal'}
        signTogglePosition="outside-left"
        detachedOutsideLeftControls
        signToggleStyle="toggle"
        className="w-full"
        shellClassOverride="min-h-[2.85rem]"
        inputClassName="expense-amount-input text-center"
      />
    </div>
  )

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
          {amountField}
          <ExpenseEntityFields
            payeeId={form.payeeId}
            categoryId={form.categoryId}
            showCategoryField={!isSplitMode}
            payeeOptions={payeeOptions}
            categoryOptions={categoryOptions}
            recentPayeeOptions={recentPayeeOptions}
            recentCategoryOptions={recentCategoryOptions}
            selectedPayeeName={selectedPayeeName}
            selectedCategoryName={selectedCategoryName}
            showPayeePicker={showPayeePicker}
            showCategoryPicker={showCategoryPicker}
            onShowPayeePickerChange={setShowPayeePicker}
            onShowCategoryPickerChange={setShowCategoryPicker}
            onPayeeChange={handlePayeeManualSelect}
            onCategoryChange={(id) =>
              setForm((current) => ({
                ...current,
                categoryId: id != null ? String(id) : '',
              }))
            }
            onCreatePayee={async (name) => {
              const newId = await StorageService.addPayee(name)
              await refreshPayees()
              await refreshPayeesProp?.()
              return newId
            }}
            onCreateCategory={createCategory}
            desktopPayeeTestId="desktop-payee-dropdown"
            desktopCategoryTestId="desktop-category-dropdown"
            mobilePayeeTestId="mobile-payee-trigger"
            mobileCategoryTestId="mobile-category-trigger"
            onManagePayees={() => setShowPayeeModal(true)}
            onManageCategories={() => setShowCatModal(true)}
          />
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
          <div className="flex flex-col gap-1 text-sm text-theme-muted">
            <span>Notes</span>
            <input
              type="text"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              onBlur={(event) => runPayeeMatch(event.target.value)}
              placeholder="Optional"
              className={inputCls}
            />
          </div>
          <PayeeSuggestionBanner
            payeeId={form.payeeId}
            payeeSuggestion={payeeSuggestion}
            payeeSuggestionConfidence={payeeSuggestionConfidence}
            onAcceptSuggestion={acceptSuggestion}
            onDismissSuggestion={dismissSuggestion}
          />
          <TagMultiSelect
            tags={tags}
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
            rootClassName="gap-0"
            inputClassName="min-w-0"
            onCreate={async (name) => {
              const id = await StorageService.addTag(name)
              triggerSync?.()
              await refreshTags()
              return id
            }}
          />
          <div className="space-y-3">
            <label
              className={cn(
                'flex items-start gap-3 rounded-theme-medium border border-theme-border bg-theme-surface px-3 py-2.5 transition-colors',
                canToggleSplitMode ? 'cursor-pointer' : 'opacity-60',
              )}
            >
              <input
                type="checkbox"
                checked={isSplitMode}
                onChange={toggleSplitMode}
                disabled={!canToggleSplitMode}
                data-testid="toggle-split-mode"
                className="sr-only"
                aria-label="Enable split transaction"
              />
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  isSplitMode
                    ? 'border-theme-primary bg-theme-primary-subtle text-theme-primary'
                    : 'border-theme-border bg-theme-background text-transparent',
                )}
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6.25L4.75 8.5L9.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-theme-text">Split transaction</span>
                <span className="block text-xs text-theme-muted">
                  {canToggleSplitMode
                    ? 'Break this expense into multiple category allocations.'
                    : 'This expense already belongs to a saved split transaction.'}
                </span>
              </span>
            </label>

            {isSplitMode && (
              <div className="space-y-3 rounded-theme-large border border-theme-border bg-theme-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-theme-text">Split allocations</div>
                    <div className="mt-0.5 text-xs text-theme-muted">
                      Each row uses the parent payee: {splitPayeeInheritanceLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addSplitChild}
                    className="btn-cancel-sm flex-none px-3 py-1.5 text-xs"
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
                {splitChildren.map((child, index) => {
                  const selectedSplitCategoryName = categoryOptions.find(
                    (option) => option.id === Number(child.categoryId),
                  )?.label
                  const isSplitCategoryPickerOpen = openSplitCategoryPickers[child.rowId] ?? false

                  return (
                    <div
                      key={child.rowId}
                      className="space-y-3 rounded-theme-medium border border-theme-border bg-theme-surface p-3"
                      data-testid={`split-row-${index}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-theme-primary-subtle text-xs font-semibold text-theme-primary">
                            {index + 1}
                          </span>
                          <span className="min-w-0 truncate text-sm font-medium text-theme-text">
                            Allocation
                          </span>
                        </div>
                        <span className="min-w-0 truncate text-xs text-theme-muted">
                          {splitPayeeInheritanceLabel}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                        <div className="flex flex-col gap-1">
                          <label className="block text-sm text-theme-muted">{`Split category ${index + 1}`}</label>
                          {isMobileViewport ? (
                            <div data-testid={`mobile-split-category-trigger-${index}`}>
                              <SingleSelectTrigger
                                value={selectedSplitCategoryName}
                                placeholder="Select category"
                                isOpen={isSplitCategoryPickerOpen}
                                ariaLabel={`Split category ${index + 1}`}
                                onClick={() =>
                                  setOpenSplitCategoryPickers((prev) => ({
                                    ...prev,
                                    [child.rowId]: true,
                                  }))
                                }
                              />
                              <MobileEntityPicker
                                open={isSplitCategoryPickerOpen}
                                title="Choose Category"
                                value={child.categoryId ? Number(child.categoryId) : undefined}
                                options={categoryOptions}
                                recentOptions={recentCategoryOptions}
                                placeholder="Search or add category"
                                emptyMessage="No categories found."
                                createHint="Type a new category name to add it."
                                allowCreate
                                onChange={(id) =>
                                  setSplitChildField(
                                    child.rowId,
                                    'categoryId',
                                    id != null ? String(id) : '',
                                  )
                                }
                                onCreate={createCategory}
                                onClose={() =>
                                  setOpenSplitCategoryPickers((prev) => ({
                                    ...prev,
                                    [child.rowId]: false,
                                  }))
                                }
                              />
                            </div>
                          ) : (
                            <div data-testid={`desktop-split-category-dropdown-${index}`}>
                              <DesktopDropdown
                                value={child.categoryId ? Number(child.categoryId) : undefined}
                                options={categoryOptions}
                                recentOptions={recentCategoryOptions}
                                placeholder="Select category"
                                emptyMessage="No categories found."
                                createHint="Type a new category name to add it."
                                allowCreate
                                ariaLabel={`Split category ${index + 1}`}
                                autoFocus={false}
                                onChange={(id) =>
                                  setSplitChildField(
                                    child.rowId,
                                    'categoryId',
                                    id != null ? String(id) : '',
                                  )
                                }
                                onCreate={createCategory}
                              />
                            </div>
                          )}
                        </div>
                        <MoneyInput
                          label={`Split amount ${index + 1}`}
                          value={Number.parseFloat(child.amount || '0')}
                          onChange={(amount) =>
                            setSplitChildField(child.rowId, 'amount', amount.toFixed(decimalPlaces))
                          }
                          currency={moneyConfig.currency}
                          locale={moneyConfig.locale}
                          allowNegative
                          entryMode={isMobileViewport ? 'cents' : 'decimal'}
                          size="md"
                          className="w-full"
                          inputClassName="text-right"
                        />
                      </div>
                      <label className="flex flex-col gap-1 text-xs text-theme-muted">
                        Notes
                        <input
                          type="text"
                          value={child.notes}
                          onChange={(event) =>
                            setSplitChildField(child.rowId, 'notes', event.target.value)
                          }
                          className={inputCls}
                          placeholder="Optional"
                          aria-label={`Split notes ${index + 1}`}
                        />
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
                  )
                })}
                <div
                  className={cn(
                    'rounded-theme-medium border px-3 py-2 text-sm',
                    splitReconciliation.isBalanced
                      ? 'border-[color:color-mix(in_srgb,var(--theme-success)_30%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-success)_7%,var(--theme-surface))]'
                      : splitReconciliation.difference > 0
                        ? 'border-theme-warning-subtle bg-theme-warning-subtle'
                        : 'border-theme-danger-subtle bg-theme-danger-subtle',
                  )}
                >
                  {splitReconciliation.isBalanced ? (
                    <span className="font-medium text-theme-success" data-testid="split-balanced">
                      Balanced: split rows match the total.
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
