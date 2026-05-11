import { useState, useEffect, useMemo, useCallback } from 'react'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import DatePicker from '../../components/inputs/DatePicker'
import MobileEntityPicker from '../../components/inputs/MobileEntityPicker'
import SingleSelectTrigger from '../../components/inputs/SingleSelectTrigger'
import DesktopDropdown from '../../components/inputs/DesktopDropdown'
import { StorageService } from '../../services/storageService'
import { cn } from '../../utils/cn'
import { toISODate, parseISODate } from '../../utils/historicalDataHelpers'

import { usePayees } from '../../hooks/useLocalData'
import type { Schedule, FixedExpense, Category } from '../../types'

const SCHEDULE_TYPES = [
  { value: 'income', label: 'Monthly Income' },
  { value: 'savingsRate', label: 'Auto Savings %' },
  { value: 'fixedExpense', label: 'Fixed Expense' },
  { value: 'expense', label: 'Expense' },
]

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
        label: c.name,
      })),
    [activeCategories],
  )
  const payeeOptions = useMemo(
    () =>
      activePayees.map((p) => ({
        id: p.id as number,
        label: p.name,
      })),
    [activePayees],
  )

  const selectedCategoryName = categoryOptions.find((o) => o.id === Number(categoryId))?.label
  const selectedPayeeName = payeeOptions.find((o) => o.id === Number(payeeId))?.label

  const reset = useCallback(() => {
    setType('income')
    setTargetId('')
    setEffectiveDate(currentMonthStr)
    setNewValue('')
    setNote('')
    setCategoryId('')
    setPayeeId('')
    setDescription('')
    setErrors([])
  }, [currentMonthStr])

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
  }, [editSchedule, reset])

  const validate = (): boolean => {
    const errs: string[] = []
    if (isReadOnly) {
      setErrors(errs)
      return false
    }

    const val = parseFloat(newValue)
    if (Number.isNaN(val)) errs.push('Value must be a number.')
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
      const parsed = parseISODate(effectiveDate) as { year: number; month: number; day: number }
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
            data-testid="schedule-type-select"
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
                data-testid="schedule-value-input"
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
                data-testid="schedule-note-input"
              />
            </div>
          </>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map((err) => (
              <p key={err} className="text-theme-danger text-xs">
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
        <button
          onClick={onSave}
          className="btn-modal-primary flex-1"
          disabled={saving}
          data-testid="btn-save-schedule"
        >
          {saving ? 'Saving…' : editSchedule ? 'Update' : 'Save Schedule'}
        </button>
      )}
    </ModalFooter>
  )
}
