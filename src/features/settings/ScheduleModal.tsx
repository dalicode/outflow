import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import DatePicker from '../../components/inputs/DatePicker'
import MobileEntityPicker from '../../components/inputs/MobileEntityPicker'
import { StorageService } from '../../services/storageService'
import { cn } from '../../utils/cn'
import Spinner from '../../components/ui/Spinner'
import { toISODate, parseISODate } from '../../utils/historicalDataHelpers'
import { normalizeName } from '../../utils/normalizeName'
import {
  getFilteredOptions,
  hasExactMatch,
  type ComboboxOption,
} from '../../components/inputs/comboboxUtils'
import { usePayees } from '../../hooks/useLocalData'
import type { Schedule, FixedExpense, Category } from '../../types'

const SCHEDULE_TYPES = [
  { value: 'income', label: 'Monthly Income' },
  { value: 'savingsRate', label: 'Auto Savings %' },
  { value: 'fixedExpense', label: 'Fixed Expense' },
  { value: 'expense', label: 'Expense' },
]

// ── Shared single-select trigger (mirrors ExpenseForm) ────────────────────

interface SingleSelectTriggerProps {
  value?: string
  placeholder: string
  isOpen: boolean
  onClick: () => void
  disabled?: boolean
}

function SingleSelectTrigger({
  value,
  placeholder,
  isOpen,
  onClick,
  disabled,
}: SingleSelectTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-3 rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2 text-left text-sm transition-colors',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
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

// ── Desktop dropdown (mirrors ExpenseForm) ────────────────────────────────

interface DesktopDropdownProps {
  value?: string | number
  options: ComboboxOption[]
  placeholder: string
  emptyMessage: string
  createHint?: string
  allowCreate?: boolean
  allowClear?: boolean
  clearLabel?: string
  disabled?: boolean
  onChange: (id: string | number | undefined) => void
  onCreate?: (name: string) => Promise<string | number>
}

function DesktopDropdown({
  value,
  options,
  placeholder,
  emptyMessage,
  createHint = 'Type a new name to add it.',
  allowCreate = false,
  allowClear = false,
  clearLabel = 'Clear selection',
  disabled,
  onChange,
  onCreate,
}: DesktopDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [panelStyle, setPanelStyle] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const triggerRef = useCallback((node: HTMLDivElement | null) => {
    triggerNodeRef.current = node
  }, [])
  const triggerNodeRef = { current: null as HTMLDivElement | null }
  const panelRef = { current: null as HTMLDivElement | null }
  const searchInputRef = { current: null as HTMLInputElement | null }

  const selectedOption = useMemo(() => options.find((o) => o.id === value), [options, value])

  const filteredOptions = useMemo(() => getFilteredOptions(options, query), [options, query])

  const showCreateOption = allowCreate && onCreate && query.trim() && !hasExactMatch(options, query)
  const showCreateHint = allowCreate && onCreate && !query.trim()

  const updatePosition = useCallback(() => {
    const rect = triggerNodeRef.current?.getBoundingClientRect()
    if (!rect) return
    setPanelStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setCreateError(null)
      setPanelStyle(null)
      return
    }
    updatePosition()
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
    const handlePointerDown = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (triggerNodeRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setIsOpen(false)
    }
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, updatePosition])

  const handleSelect = (id: string | number | undefined) => {
    onChange(id)
    setIsOpen(false)
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
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
      />
      {isOpen &&
        panelStyle &&
        createPortal(
          <div
            ref={(n) => {
              panelRef.current = n
            }}
            className="fixed z-[70] rounded-theme-medium border border-theme-border bg-theme-background p-2 shadow-lg"
            style={{
              top: panelStyle.top,
              left: panelStyle.left,
              width: panelStyle.width,
            }}
          >
            <input
              ref={(n) => {
                searchInputRef.current = n
              }}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setCreateError(null)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (showCreateOption && filteredOptions.length === 0) {
                  void handleCreate()
                  return
                }
                if (filteredOptions[0]) handleSelect(filteredOptions[0].id)
              }}
              placeholder={placeholder}
              className="input-theme w-full px-3 py-2 text-sm"
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
              {allowClear && value != null && (
                <button
                  type="button"
                  onClick={() => handleSelect(undefined)}
                  className="flex min-h-8 w-full items-center border-b border-theme-border px-2 py-1 text-left text-sm text-theme-muted transition-colors hover:bg-theme-border"
                >
                  <span className="min-w-0 truncate">{clearLabel}</span>
                </button>
              )}
              {filteredOptions.map((opt) => {
                const isSelected = opt.id === value
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={cn(
                      'flex min-h-8 w-full items-center justify-between gap-3 border-b border-theme-border px-2 py-1 text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-theme-primary-subtle text-theme-primary font-medium'
                        : 'text-theme-text hover:bg-theme-border',
                    )}
                  >
                    <span className="min-w-0 truncate">{opt.label}</span>
                    {isSelected && (
                      <span className="text-xs font-medium text-theme-primary">Selected</span>
                    )}
                  </button>
                )
              })}
              {showCreateOption && (
                <button
                  type="button"
                  onClick={() => void handleCreate()}
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
              {filteredOptions.length === 0 && !showCreateOption && (
                <div className="px-2.5 py-3 text-center text-xs text-theme-muted">
                  {emptyMessage}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────

interface ScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
  editSchedule?: Schedule | null
}

export default function ScheduleModal({
  isOpen,
  onClose,
  onComplete,
  editSchedule = null,
}: ScheduleModalProps) {
  const [type, setType] = useState<Schedule['type']>('income')
  const [targetId, setTargetId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [newValue, setNewValue] = useState('')
  const [note, setNote] = useState('')
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [payeeId, setPayeeId] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showPayeePicker, setShowPayeePicker] = useState(false)

  const { payees, refresh: refreshPayees } = usePayees()

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentMonthStr = toISODate(currentYear, currentMonth, 1)

  const isReadOnly = editSchedule
    ? editSchedule.effectiveYear < currentYear ||
      (editSchedule.effectiveYear === currentYear && editSchedule.effectiveMonth <= currentMonth)
    : false

  const activeCategories = useMemo(() => categories.filter((c) => !c.isArchived), [categories])
  const activePayees = useMemo(
    () => payees.filter((p) => !p.isArchived).sort((a, b) => a.name.localeCompare(b.name)),
    [payees],
  )
  const categoryOptions = useMemo(
    () =>
      activeCategories.map((c) => ({
        id: c.id as number,
        label: normalizeName(c.name),
      })),
    [activeCategories],
  )
  const payeeOptions = useMemo(
    () =>
      activePayees.map((p) => ({
        id: p.id as number,
        label: normalizeName(p.name),
      })),
    [activePayees],
  )

  const selectedCategoryName = categoryOptions.find((o) => o.id === Number(categoryId))?.label
  const selectedPayeeName = payeeOptions.find((o) => o.id === Number(payeeId))?.label

  useEffect(() => {
    if (!isOpen) return
    const load = async () => {
      const defs = await StorageService.getActiveFixedExpenses()
      setFixedExpenses(defs)
      const cats = await StorageService.getCategories()
      setCategories(cats)
    }
    load()
  }, [isOpen])

  useEffect(() => {
    if (editSchedule) {
      setType(editSchedule.type)
      setTargetId(editSchedule.targetId ? String(editSchedule.targetId) : '')
      setEffectiveDate(
        toISODate(editSchedule.effectiveYear, editSchedule.effectiveMonth, editSchedule.day ?? 1),
      )
      setNewValue(String(editSchedule.newValue))
      setNote(editSchedule.note || '')
      setCategoryId(editSchedule.categoryId ? String(editSchedule.categoryId) : '')
      setPayeeId(editSchedule.payeeId ? String(editSchedule.payeeId) : '')
      setDescription('')
    } else {
      reset()
    }
  }, [editSchedule, isOpen])

  const reset = () => {
    setType('income')
    setTargetId('')
    setEffectiveDate(currentMonthStr)
    setNewValue('')
    setNote('')
    setCategoryId('')
    setPayeeId('')
    setDescription('')
    setErrors([])
  }

  const validate = (): boolean => {
    const errs: string[] = []
    if (isReadOnly) {
      setErrors(errs)
      return false
    }

    const val = parseFloat(newValue)
    if (isNaN(val)) errs.push('Value must be a number.')
    else if (type === 'income' && val <= 0) errs.push('Income must be greater than 0.')
    else if (type === 'savingsRate' && (val < 0 || val > 100))
      errs.push('Savings rate must be between 0 and 100.')
    else if (type === 'fixedExpense' && val === 0) errs.push('Fixed expense amount cannot be zero.')
    else if (type === 'expense' && val <= 0) errs.push('Expense amount must be greater than 0.')

    if (type === 'fixedExpense' && !targetId) errs.push('Please select a fixed expense.')
    if (type === 'expense' && !categoryId) errs.push('Please select a category.')

    if (!effectiveDate) {
      errs.push('Please select a date.')
    } else {
      const parsed = parseISODate(effectiveDate)
      if (!parsed) {
        errs.push('Invalid date format.')
      } else if (type === 'expense') {
        if (
          parsed.year < currentYear ||
          (parsed.year === currentYear && parsed.month < currentMonth) ||
          (parsed.year === currentYear &&
            parsed.month === currentMonth &&
            parsed.day < now.getDate())
        ) {
          errs.push('Date must be today or in the future.')
        }
      } else {
        if (
          parsed.year < currentYear ||
          (parsed.year === currentYear && parsed.month < currentMonth)
        ) {
          errs.push('Effective date must be in the current or a future month.')
        }
      }
    }

    setErrors(errs)
    return errs.length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const parsed = parseISODate(effectiveDate)!
      const payload: Omit<Schedule, 'id' | 'isActive' | 'createdAt'> =
        type === 'expense'
          ? {
              type,
              targetId: null,
              effectiveYear: parsed.year,
              effectiveMonth: parsed.month,
              day: parsed.day,
              newValue: parseFloat(newValue),
              note: note.trim() || undefined,
              categoryId: parseInt(categoryId, 10),
              payeeId: payeeId ? parseInt(payeeId, 10) : undefined,
            }
          : {
              type,
              targetId: type === 'fixedExpense' ? parseInt(targetId, 10) : null,
              effectiveYear: parsed.year,
              effectiveMonth: parsed.month,
              newValue: parseFloat(newValue),
              note: note.trim() || undefined,
            }

      if (editSchedule && editSchedule.id != null) {
        await StorageService.updateSchedule(editSchedule.id, payload)
      } else {
        await StorageService.addSchedule(payload)
      }

      onComplete?.()
      handleClose()
    } catch (err) {
      console.error('Schedule save failed:', err)
      setErrors([`Error: ${(err as Error).message}`])
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const inputCls = 'input-md px-3 py-2 text-sm w-full'
  const selectCls = 'input-md px-3 py-2 text-sm w-full cursor-pointer'
  const disabledCls = ' opacity-60 cursor-not-allowed'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isReadOnly ? 'Schedule Details' : editSchedule ? 'Edit Schedule' : 'Add Schedule'}
      size="md"
      footer={
        <ScheduleModalFooter
          isReadOnly={isReadOnly}
          onClose={handleClose}
          onSave={handleSave}
          saving={saving}
          editSchedule={!!editSchedule}
        />
      }
    >
      <div className="space-y-4">
        {isReadOnly && (
          <div className="modal-readonly-banner">
            This schedule has already taken effect and cannot be edited.
          </div>
        )}

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-theme-text">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Schedule['type'])}
            className={cn(selectCls, isReadOnly && disabledCls)}
            disabled={isReadOnly}
          >
            {SCHEDULE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Fixed expense target */}
        {type === 'fixedExpense' && (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-theme-text">Fixed Expense</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={cn(selectCls, isReadOnly && disabledCls)}
              disabled={isReadOnly}
            >
              <option value="">Select…</option>
              {fixedExpenses.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Expense-specific fields (mirrors ExpenseForm) ── */}
        {type === 'expense' ? (
          <>
            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-sm text-theme-muted">Date</label>
              <DatePicker
                value={effectiveDate}
                onChange={setEffectiveDate}
                disabled={isReadOnly}
                variant="inline"
                inputStyle="default"
              />
            </div>

            {/* Payee */}
            <div className="space-y-1.5">
              <label className="text-sm text-theme-muted">Payee</label>
              {/* Desktop */}
              <div className="hidden sm:block">
                <DesktopDropdown
                  value={payeeId ? Number(payeeId) : undefined}
                  options={payeeOptions}
                  placeholder="Select payee"
                  emptyMessage="No payees found."
                  createHint="Type a new payee name to add it."
                  allowCreate
                  allowClear
                  clearLabel="No payee"
                  disabled={isReadOnly}
                  onChange={(id) => setPayeeId(id != null ? String(id) : '')}
                  onCreate={async (name) => {
                    const newId = await StorageService.addPayee(name)
                    await refreshPayees()
                    return newId
                  }}
                />
              </div>
              {/* Mobile */}
              <div className="block sm:hidden">
                <SingleSelectTrigger
                  value={selectedPayeeName}
                  placeholder="Select payee"
                  isOpen={showPayeePicker}
                  disabled={isReadOnly}
                  onClick={() => !isReadOnly && setShowPayeePicker(true)}
                />
                <MobileEntityPicker
                  open={showPayeePicker}
                  title="Choose Payee"
                  value={payeeId ? Number(payeeId) : undefined}
                  options={payeeOptions}
                  placeholder="Search or add payee"
                  emptyMessage="No payees found."
                  createHint="Type a new payee name to add it."
                  allowCreate
                  allowClear
                  clearLabel="No payee"
                  onChange={(id) => setPayeeId(id != null ? String(id) : '')}
                  onCreate={async (name) => {
                    const newId = await StorageService.addPayee(name)
                    await refreshPayees()
                    return newId
                  }}
                  onClose={() => setShowPayeePicker(false)}
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-sm text-theme-muted">Category</label>
              {/* Desktop */}
              <div className="hidden sm:block">
                <DesktopDropdown
                  value={categoryId ? Number(categoryId) : undefined}
                  options={categoryOptions}
                  placeholder="Select category"
                  emptyMessage="No categories found."
                  createHint="Type a new category name to add it."
                  allowCreate
                  disabled={isReadOnly}
                  onChange={(id) => setCategoryId(id != null ? String(id) : '')}
                  onCreate={async (name) => {
                    const newId = await StorageService.addCategory(name)
                    const cats = await StorageService.getCategories()
                    setCategories(cats)
                    return newId
                  }}
                />
              </div>
              {/* Mobile */}
              <div className="block sm:hidden">
                <SingleSelectTrigger
                  value={selectedCategoryName}
                  placeholder="Select category"
                  isOpen={showCategoryPicker}
                  disabled={isReadOnly}
                  onClick={() => !isReadOnly && setShowCategoryPicker(true)}
                />
                <MobileEntityPicker
                  open={showCategoryPicker}
                  title="Choose Category"
                  value={categoryId ? Number(categoryId) : undefined}
                  options={categoryOptions}
                  placeholder="Search or add category"
                  emptyMessage="No categories found."
                  createHint="Type a new category name to add it."
                  allowCreate
                  onChange={(id) => setCategoryId(id != null ? String(id) : '')}
                  onCreate={async (name) => {
                    const newId = await StorageService.addCategory(name)
                    const cats = await StorageService.getCategories()
                    setCategories(cats)
                    return newId
                  }}
                  onClose={() => setShowCategoryPicker(false)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm text-theme-muted">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                disabled={isReadOnly}
                className={cn(inputCls, isReadOnly && disabledCls)}
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-sm text-theme-muted">Amount</label>
              <input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="0.00"
                step="0.01"
                disabled={isReadOnly}
                className={cn(inputCls, isReadOnly && disabledCls)}
              />
            </div>
          </>
        ) : (
          <>
            {/* Effective Date (non-expense types) */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-theme-text">Effective Date</label>
              <DatePicker
                value={effectiveDate}
                onChange={setEffectiveDate}
                disabled={isReadOnly}
                variant="inline"
                inputStyle="default"
              />
            </div>

            {/* Value */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-theme-text">
                {type === 'savingsRate'
                  ? 'New Rate (%)'
                  : type === 'income'
                    ? 'New Monthly Income'
                    : 'New Amount'}
              </label>
              <input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={type === 'savingsRate' ? 'e.g. 25' : 'e.g. 6000'}
                step={type === 'savingsRate' ? '0.1' : '0.01'}
                className={cn(inputCls, isReadOnly && disabledCls)}
                disabled={isReadOnly}
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-theme-text">
                Note <span className="text-theme-muted font-normal">(optional)</span>
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Annual salary review"
                className={cn(inputCls, isReadOnly && disabledCls)}
                disabled={isReadOnly}
              />
            </div>
          </>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map((err, i) => (
              <p key={i} className="text-theme-danger text-xs">
                {err}
              </p>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function ScheduleModalFooter({
  isReadOnly,
  onClose,
  onSave,
  saving,
  editSchedule,
}: {
  isReadOnly: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  editSchedule: boolean
}) {
  return (
    <ModalFooter>
      <button onClick={onClose} className="btn-cancel-sm flex-1">
        {isReadOnly ? 'Close' : 'Cancel'}
      </button>
      {!isReadOnly && (
        <button onClick={onSave} className="btn-modal-primary flex-1" disabled={saving}>
          {saving ? 'Saving…' : editSchedule ? 'Update' : 'Save Schedule'}
        </button>
      )}
    </ModalFooter>
  )
}
