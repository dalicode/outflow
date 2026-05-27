import { useState, useEffect, useMemo, useCallback } from 'react'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import DatePicker from '../../components/inputs/DatePicker'
import DesktopDropdown from '../../components/inputs/DesktopDropdown'
import MoneyInput from '../../components/inputs/MoneyInput'
import { useSettings } from '../../context/settingsContext'
import { ExpenseEntityFields, PayeeSuggestionBanner, useExpenseEntitySelection } from '../expenses'
import { addCategory, getCategories } from '../../services/repositories/categoryRepository'
import { getActiveFixedExpenses } from '../../services/repositories/fixedExpenseRepository'
import { addPayee } from '../../services/repositories/payeeRepository'
import { addSchedule, updateSchedule } from '../../services/repositories/scheduleRepository'
import { cn } from '../../lib/cn'
import { toISODate, parseISODate } from '../../utils/historicalDataHelpers'
import { resolveMoneyLocaleConfig } from '../../utils/moneyInput'

import { useExpenses, usePayees } from '../../hooks/useLocalData'
import type { Schedule, FixedExpense, Category } from '../../types'

const SCHEDULE_TYPES = [
  { value: 'income', label: 'Monthly Income' },
  { value: 'savingsRate', label: 'Auto Savings %' },
  { value: 'fixedExpense', label: 'Fixed Expense' },
  { value: 'expense', label: 'Expense' },
]

const SCHEDULE_TYPE_OPTIONS = SCHEDULE_TYPES.map((typeOption) => ({
  id: typeOption.value,
  label: typeOption.label,
}))

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
  const { settings } = useSettings()
  const [type, setType] = useState<Schedule['type']>('income')
  const [targetId, setTargetId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [newValue, setNewValue] = useState('')
  const [notes, setNotes] = useState('')
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [payeeId, setPayeeId] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showPayeePicker, setShowPayeePicker] = useState(false)

  const { expenses } = useExpenses()
  const { payees, refresh: refreshPayees } = usePayees()

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentMonthStr = toISODate(currentYear, currentMonth, 1)

  const isReadOnly = editSchedule
    ? editSchedule.effectiveYear < currentYear ||
      (editSchedule.effectiveYear === currentYear && editSchedule.effectiveMonth <= currentMonth)
    : false

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
    resetSuggestions,
  } = useExpenseEntitySelection({
    categories,
    payees,
    expenses,
    categoryId,
    payeeId,
    onCategoryIdChange: setCategoryId,
    onPayeeIdChange: setPayeeId,
  })
  const fixedExpenseOptions = useMemo(
    () =>
      fixedExpenses.map((expense) => ({
        id: expense.id as number,
        label: expense.name,
      })),
    [fixedExpenses],
  )
  const moneyConfig = resolveMoneyLocaleConfig(settings.currencySymbol)

  const reset = useCallback(() => {
    setType('income')
    setTargetId('')
    setEffectiveDate(currentMonthStr)
    setNewValue('')
    setNotes('')
    setCategoryId('')
    setPayeeId('')
    resetSuggestions()
    setErrors([])
  }, [currentMonthStr, resetSuggestions])

  useEffect(() => {
    if (!isOpen) return
    const load = async () => {
      const defs = await getActiveFixedExpenses()
      setFixedExpenses(defs)
      const cats = await getCategories()
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
      setNotes(editSchedule.notes || '')
      setCategoryId(editSchedule.categoryId ? String(editSchedule.categoryId) : '')
      setPayeeId(editSchedule.payeeId ? String(editSchedule.payeeId) : '')
      resetSuggestions()
    } else {
      reset()
    }
  }, [editSchedule, reset, resetSuggestions])

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
              notes: notes.trim() || undefined,
              categoryId: parseInt(categoryId, 10),
              payeeId: payeeId ? parseInt(payeeId, 10) : undefined,
            }
          : {
              type,
              targetId: type === 'fixedExpense' ? parseInt(targetId, 10) : null,
              effectiveYear: parsed.year,
              effectiveMonth: parsed.month,
              newValue: parseFloat(newValue),
              notes: notes.trim() || undefined,
            }

      if (editSchedule && editSchedule.id != null) {
        await updateSchedule(editSchedule.id, payload)
      } else {
        await addSchedule(payload)
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
          <DesktopDropdown
            value={type}
            options={SCHEDULE_TYPE_OPTIONS}
            placeholder="Select type"
            emptyMessage="No schedule types available."
            ariaLabel="Schedule type"
            searchable={false}
            preserveOrder
            disabled={isReadOnly}
            triggerClassName={cn(isReadOnly && disabledCls)}
            onChange={(nextValue) => {
              if (typeof nextValue === 'string') {
                setType(nextValue as Schedule['type'])
              }
            }}
          />
        </div>

        {/* Fixed expense target */}
        {type === 'fixedExpense' && (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-theme-text">Fixed Expense</label>
            <DesktopDropdown
              value={targetId ? Number(targetId) : undefined}
              options={fixedExpenseOptions}
              placeholder="Select fixed expense"
              emptyMessage="No fixed expenses found."
              ariaLabel="Fixed expense"
              searchable={false}
              preserveOrder
              disabled={isReadOnly}
              triggerClassName={cn(isReadOnly && disabledCls)}
              onChange={(id) => setTargetId(id != null ? String(id) : '')}
            />
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

            <ExpenseEntityFields
              payeeId={payeeId}
              categoryId={categoryId}
              disabled={isReadOnly}
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
              onCategoryChange={(id) => setCategoryId(id != null ? String(id) : '')}
              onCreatePayee={async (name) => {
                const newId = await addPayee(name)
                await refreshPayees()
                return newId
              }}
              onCreateCategory={async (name) => {
                const newId = await addCategory(name)
                const cats = await getCategories()
                setCategories(cats)
                return newId
              }}
            />

            <div className="space-y-1.5">
              <label className="text-sm text-theme-muted">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={(e) => runPayeeMatch(e.target.value)}
                placeholder="Optional"
                disabled={isReadOnly}
                className={cn(inputCls, isReadOnly && disabledCls)}
                data-testid="schedule-notes-input"
              />
            </div>

            <PayeeSuggestionBanner
              payeeId={payeeId}
              payeeSuggestion={payeeSuggestion}
              payeeSuggestionConfidence={payeeSuggestionConfidence}
              onAcceptSuggestion={acceptSuggestion}
              onDismissSuggestion={dismissSuggestion}
            />

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-sm text-theme-muted">Amount</label>
              <MoneyInput
                value={Number.parseFloat(newValue || '0')}
                onChange={(value) => setNewValue(value.toFixed(2))}
                currency={moneyConfig.currency}
                locale={moneyConfig.locale}
                placeholder="0.00"
                size="md"
                showCurrencyCode
                disabled={isReadOnly}
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
              {type === 'savingsRate' ? (
                <input
                  type="number"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="e.g. 25"
                  step="0.1"
                  className={cn(inputCls, isReadOnly && disabledCls)}
                  disabled={isReadOnly}
                  data-testid="schedule-value-input"
                />
              ) : (
                <MoneyInput
                  value={Number.parseFloat(newValue || '0')}
                  onChange={(value) => setNewValue(value.toFixed(2))}
                  currency={moneyConfig.currency}
                  locale={moneyConfig.locale}
                  placeholder="e.g. 6000"
                  size="md"
                  showCurrencyCode
                  disabled={isReadOnly}
                  inputTestId="schedule-value-input"
                />
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-theme-text">
                Notes <span className="text-theme-muted font-normal">(optional)</span>
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Annual salary review"
                className={cn(inputCls, isReadOnly && disabledCls)}
                disabled={isReadOnly}
                data-testid="schedule-notes-input"
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
