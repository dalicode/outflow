import { type FormEvent, useCallback, useMemo, useState } from 'react'
import DatePicker from '../../components/inputs/DatePicker'
import MobileEntityPicker from '../../components/inputs/MobileEntityPicker'
import MoneyInput from '../../components/inputs/MoneyInput'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import { useSettings } from '../../context/settingsContext'
import { useHaptics } from '../../hooks/useHaptics'
import { useExpenses, usePayees } from '../../hooks/useLocalData'
import { StorageService } from '../../services/storageService'
import { getMostLikelyRelatedEntityId, getRecentEntityIds } from '../../utils/entityHistory'
import type { ComboboxOption } from '../../components/inputs/comboboxUtils'
import { getLocalToday } from '../../utils/historicalDataHelpers'
import { resolveMoneyLocaleConfig } from '../../utils/moneyInput'
import type { MatchConfidence } from '../../utils/payeeMatching'
import { findBestPayeeMatch, normalizePayeeText } from '../../utils/payeeMatching'
import CategoryModal from './CategoryModal'
import PayeeModal from './PayeeModal'
import './expenses.css'
import type { Category, Expense, Payee } from '../../types'
import DesktopDropdown from '../../components/inputs/DesktopDropdown'
import SingleSelectTrigger from '../../components/inputs/SingleSelectTrigger'

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

interface ExpenseFormProps {
  onAdd?: (expense: Omit<Expense, 'id'>) => void
  onUpdate?: (id: number, changes: Partial<Expense>) => void
  onClose: () => void
  categories: Category[]
  onCategoriesChange?: (
    action: 'add' | 'update' | 'delete',
    payload: { id?: number; name?: string },
  ) => Promise<number | undefined>
  initialExpense?: Expense
  refreshCategories?: () => Promise<void>
  refreshPayees?: () => Promise<void>
}

export default function ExpenseForm({
  onAdd,
  onUpdate,
  onClose,
  categories,
  onCategoriesChange,
  initialExpense,
  refreshCategories: refreshCategoriesProp,
  refreshPayees: refreshPayeesProp,
}: ExpenseFormProps) {
  const isEdit = !!initialExpense
  const { expenses } = useExpenses()
  const { payees, refresh: refreshPayees } = usePayees()
  const { settings } = useSettings()
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
  const [error, setError] = useState('')
  const [showCatModal, setShowCatModal] = useState(false)
  const [showPayeeModal, setShowPayeeModal] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showPayeePicker, setShowPayeePicker] = useState(false)
  const [payeeSuggestion, setPayeeSuggestion] = useState<Payee | null>(null)
  const [payeeSuggestionConfidence, setPayeeSuggestionConfidence] =
    useState<MatchConfidence | null>(null)
  const haptics = useHaptics()
  const [showAliasOffer, setShowAliasOffer] = useState(false)
  const [aliasSaved, setAliasSaved] = useState(false)

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

  // When user manually picks a payee while description is filled,
  // offer to save the normalized description as an alias
  const handlePayeeManualSelect = useCallback(
    (id: string | number | undefined) => {
      setForm((f) => ({ ...f, payeeId: id != null ? String(id) : '' }))
      setPayeeSuggestion(null)
      setPayeeSuggestionConfidence(null)
      setAliasSaved(false)
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
      // Offer alias if description is set and payee was manually chosen
      if (id != null && form.description.trim()) {
        const normalized = normalizePayeeText(form.description)
        if (normalized) setShowAliasOffer(true)
      } else {
        setShowAliasOffer(false)
      }
    },
    [activeCategoryIds, expenses, form.description],
  )

  const saveAlias = async () => {
    if (!form.payeeId || !form.description.trim()) return
    const normalized = normalizePayeeText(form.description)
    if (!normalized) return
    await StorageService.addPayeeAlias(Number(form.payeeId), normalized)
    setShowAliasOffer(false)
    setAliasSaved(true)
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.categoryId) {
      haptics.error()
      setError('Please select a category.')
      return
    }
    if (!form.amount || Number.isNaN(Number(form.amount)) || Number(form.amount) === 0) {
      haptics.error()
      setError('Amount cannot be zero.')
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
    } else {
      haptics.success()
      onAdd?.(payload)
      setForm(EMPTY_FORM)
    }
    setError('')
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
          {error && <p className="text-theme-danger text-sm">{error}</p>}
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
            <div className="hidden sm:block">
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
            <div className="hidden sm:block">
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
          <label className="flex flex-col gap-1 text-sm text-theme-muted">
            Description
            <input
              type="text"
              value={form.description}
              onChange={set('description')}
              onBlur={handleDescriptionBlur}
              placeholder="Optional"
              className={inputCls}
            />
          </label>

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

          {/* Alias offer banner */}
          {showAliasOffer && !aliasSaved && (
            <div className="flex items-center justify-between gap-2 rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2 text-xs">
              <span className="text-theme-muted">
                Save{' '}
                <span className="font-medium text-theme-text">
                  "{normalizePayeeText(form.description)}"
                </span>{' '}
                as an alias for faster matching next time?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={saveAlias}
                  className="font-medium text-theme-primary hover:opacity-80"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowAliasOffer(false)}
                  className="text-theme-muted hover:text-theme-text"
                >
                  No
                </button>
              </div>
            </div>
          )}
          {aliasSaved && <p className="text-xs text-theme-success">Alias saved.</p>}
          <MoneyInput
            label="Amount"
            value={Number.parseFloat(form.amount || '0')}
            onChange={(amount) => setForm((f) => ({ ...f, amount: amount.toFixed(2) }))}
            currency={moneyConfig.currency}
            locale={moneyConfig.locale}
            allowNegative
            showSignToggle
            positiveLabel="Expense"
            negativeLabel="Refund"
            negativeIndicatorLabel="Refund"
            helperText="Type numbers only - 1234 becomes $12.34"
            showCurrencyCode
            autoFocus={!isEdit}
            size="lg"
          />
        </form>
      </Modal>
      {showCatModal && (
        <CategoryModal
          categories={categories}
          onCategoriesChange={onCategoriesChange}
          refreshCategories={refreshCategoriesProp}
          onClose={() => setShowCatModal(false)}
        />
      )}
      {showPayeeModal && (
        <PayeeModal
          payees={payees}
          onPayeesChange={refreshPayees}
          refreshPayees={refreshPayeesProp}
          onClose={() => setShowPayeeModal(false)}
        />
      )}
    </>
  )
}
