import {
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  type ComboboxOption,
  getFilteredOptions,
  hasExactMatch,
} from '../../components/inputs/comboboxUtils'
import DatePicker from '../../components/inputs/DatePicker'
import MobileEntityPicker from '../../components/inputs/MobileEntityPicker'
import MoneyInput from '../../components/inputs/MoneyInput'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import Spinner from '../../components/ui/Spinner'
import { useSettings } from '../../context/settingsContext'
import { useHaptics } from '../../hooks/useHaptics'
import { useExpenses, usePayees } from '../../hooks/useLocalData'
import { StorageService } from '../../services/storageService'
import { cn } from '../../utils/cn'
import { getMostLikelyRelatedEntityId, getRecentEntityIds } from '../../utils/entityHistory'
import { getLocalToday } from '../../utils/historicalDataHelpers'
import { resolveMoneyLocaleConfig } from '../../utils/moneyInput'
import { normalizeName } from '../../utils/normalizeName'
import type { MatchConfidence } from '../../utils/payeeMatching'
import { findBestPayeeMatch, normalizePayeeText } from '../../utils/payeeMatching'
import CategoryModal from './CategoryModal'
import PayeeModal from './PayeeModal'
import './expenses.css'
import type { Category, Expense, Payee } from '../../types'

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

interface SingleSelectTriggerProps {
  value?: string
  placeholder: string
  isOpen: boolean
  onClick: () => void
}

function SingleSelectTrigger({ value, placeholder, isOpen, onClick }: SingleSelectTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-theme-medium border border-theme-border bg-theme-surface px-3 py-2.5 text-left text-sm font-semibold transition-colors focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]"
    >
      <span className={cn('min-w-0 truncate', value ? 'text-theme-text' : 'text-theme-muted')}>
        {value || placeholder}
      </span>
      <svg
        className={cn(
          'h-4 w-4 shrink-0 text-theme-muted transition-transform',
          isOpen && 'rotate-180',
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    </button>
  )
}

interface DesktopSingleSelectDropdownProps {
  value?: string | number
  options: ComboboxOption[]
  recentOptions?: ComboboxOption[]
  recentLabel?: string
  placeholder: string
  emptyMessage: string
  createHint?: string
  allowCreate?: boolean
  allowClear?: boolean
  clearLabel?: string
  autoFocus?: boolean
  onChange: (id: string | number | undefined) => void
  onCreate?: (name: string) => Promise<string | number>
}

function DesktopSingleSelectDropdown({
  value,
  options,
  recentOptions,
  recentLabel = 'Recent',
  placeholder,
  emptyMessage,
  createHint = 'Type a new name to add it.',
  allowCreate = false,
  allowClear = false,
  clearLabel = 'Clear selection',
  autoFocus = false,
  onChange,
  onCreate,
}: DesktopSingleSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [panelStyle, setPanelStyle] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Auto-open on mount when autoFocus is set
  useEffect(() => {
    if (!autoFocus) return
    const timer = window.setTimeout(() => setIsOpen(true), 50)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value),
    [options, value],
  )

  const filteredOptions = useMemo(() => getFilteredOptions(options, query), [options, query])
  const showRecentSection = Boolean(recentOptions?.length && !query.trim())
  const recentVisibleOptions = showRecentSection
    ? (recentOptions ?? []).filter((option) => !option.isArchived)
    : []
  const recentIds = useMemo(
    () => new Set(recentVisibleOptions.map((option) => option.id)),
    [recentVisibleOptions],
  )
  const displayOptions = showRecentSection
    ? filteredOptions.filter((option) => !recentIds.has(option.id))
    : filteredOptions

  const showCreateOption = allowCreate && onCreate && query.trim() && !hasExactMatch(options, query)
  const showCreateHint = allowCreate && onCreate && !query.trim()

  const updatePanelPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    setPanelStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setCreateError(null)
      setPanelStyle(null)
      return
    }

    updatePanelPosition()

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }

    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, updatePanelPosition])

  const handleSelect = (id: string | number | undefined) => {
    onChange(id)
    setIsOpen(false)
  }

  const handlePointerSelect =
    (id: string | number | undefined) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      handleSelect(id)
    }

  const handleCreate = async () => {
    if (!onCreate || isCreating) return
    const trimmed = query.trim()
    if (!trimmed) return

    setIsCreating(true)
    setCreateError(null)
    try {
      const newId = await onCreate(trimmed)
      onChange(newId)
      setIsOpen(false)
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div ref={triggerRef} className="relative">
      <SingleSelectTrigger
        value={selectedOption?.label}
        placeholder={placeholder}
        isOpen={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen &&
        panelStyle &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[70] rounded-theme-medium border border-theme-border bg-theme-background p-2 shadow-lg"
            style={{
              top: panelStyle.top,
              left: panelStyle.left,
              width: panelStyle.width,
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setCreateError(null)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (showCreateOption && displayOptions.length === 0) {
                  void handleCreate()
                  return
                }
                if (displayOptions[0]) {
                  handleSelect(displayOptions[0].id)
                }
              }}
              placeholder={placeholder}
              className="input-md w-full"
            />
            {createError && <p className="mt-1.5 text-xs text-theme-danger">{createError}</p>}
            {showCreateHint && (
              <div className="mt-2 flex items-center gap-2 text-xs text-theme-muted">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-theme-primary-subtle text-theme-primary"
                >
                  +
                </span>
                <span>{createHint}</span>
              </div>
            )}
            <div className="mt-2 max-h-52 overflow-y-auto scrollbar-auto-hide">
              <div>
                {recentVisibleOptions.length > 0 && (
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-theme-muted">
                    {recentLabel}
                  </div>
                )}
                {recentVisibleOptions.map((option) => {
                  const isSelected = option.id === value
                  return (
                    <button
                      key={`recent-${option.id}`}
                      type="button"
                      onPointerDown={handlePointerSelect(option.id)}
                      className={cn(
                        'flex min-h-8 w-full items-center justify-between gap-3 border-b border-theme-border px-2 py-1 text-left text-sm transition-colors',
                        isSelected
                          ? 'bg-theme-primary-subtle text-theme-primary font-medium'
                          : 'text-theme-text hover:bg-theme-border',
                      )}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      {isSelected && (
                        <span className="text-xs font-medium text-theme-primary">Selected</span>
                      )}
                    </button>
                  )
                })}
                {allowClear && value != null && (
                  <button
                    type="button"
                    onPointerDown={handlePointerSelect(undefined)}
                    className="flex min-h-8 w-full items-center border-b border-theme-border px-2 py-1 text-left text-sm text-theme-muted transition-colors hover:bg-theme-border"
                  >
                    <span className="min-w-0 truncate">{clearLabel}</span>
                  </button>
                )}
                {displayOptions.map((option) => {
                  const isSelected = option.id === value
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onPointerDown={handlePointerSelect(option.id)}
                      className={cn(
                        'flex min-h-8 w-full items-center justify-between gap-3 border-b border-theme-border px-2 py-1 text-left text-sm transition-colors',
                        isSelected
                          ? 'bg-theme-primary-subtle text-theme-primary font-medium'
                          : 'text-theme-text hover:bg-theme-border',
                      )}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      {isSelected && (
                        <span className="text-xs font-medium text-theme-primary">Selected</span>
                      )}
                    </button>
                  )
                })}
                {showCreateOption && (
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      void handleCreate()
                    }}
                    disabled={isCreating}
                    className={cn(
                      'flex min-h-8 w-full items-center gap-2 border-b border-theme-border px-2 py-1 text-left text-sm transition-colors',
                      isCreating
                        ? 'cursor-not-allowed opacity-60'
                        : 'text-theme-text hover:bg-theme-border',
                    )}
                  >
                    {isCreating ? (
                      <span className="flex items-center gap-2 text-theme-text">
                        <Spinner size="sm" />
                        Adding...
                      </span>
                    ) : (
                      <>
                        <span
                          aria-hidden="true"
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-theme-primary-subtle text-theme-primary"
                        >
                          +
                        </span>
                        <span>Add "{query.trim()}"</span>
                      </>
                    )}
                  </button>
                )}
                {displayOptions.length === 0 &&
                  !showCreateOption &&
                  recentVisibleOptions.length === 0 && (
                    <div className="px-2.5 py-3 text-center text-xs text-theme-muted">
                      {emptyMessage}
                    </div>
                  )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
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
        label: normalizeName(c.name),
      })),
    [activeCategories],
  )
  const payeeOptions = useMemo<ComboboxOption[]>(
    () => activePayees.map((p) => ({ id: p.id, label: normalizeName(p.name) })),
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
              <DesktopSingleSelectDropdown
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
              <DesktopSingleSelectDropdown
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
                <span className="font-medium text-theme-text">
                  {normalizeName(payeeSuggestion.name)}
                </span>
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
