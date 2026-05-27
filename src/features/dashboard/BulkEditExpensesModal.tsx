import { type FormEvent, useEffect, useMemo, useState } from 'react'
import DatePicker from '../../components/inputs/DatePicker'
import MobileEntityPicker from '../../components/inputs/MobileEntityPicker'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import { StorageService } from '../../services/storageService'
import type { Category, Expense, Payee } from '../../types'
import { cn } from '../../utils/cn'
import DesktopDropdown from '../../components/inputs/DesktopDropdown'
import SingleSelectTrigger from '../../components/inputs/SingleSelectTrigger'

interface BulkEditExpensesModalProps {
  isOpen: boolean
  selectedExpenses: Expense[]
  categories: Category[]
  payees: Payee[]
  onClose: () => void
  onApply: (changes: Partial<Expense>) => Promise<void>
  refreshCategories?: () => Promise<void>
  refreshPayees?: () => Promise<void>
}

interface BulkEditFieldProps {
  checked: boolean
  label: string
  children: React.ReactNode
  onToggle: (checked: boolean) => void
}

function BulkEditField({ checked, label, children, onToggle }: BulkEditFieldProps) {
  return (
    <div className="rounded-theme-medium border border-theme-border bg-theme-background">
      <label className="flex items-center gap-3 border-b border-theme-border px-3 py-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 rounded border-theme-border"
        />
        <span className="text-sm font-medium text-theme-text">{label}</span>
      </label>
      <div className={cn('p-3', !checked && 'pointer-events-none opacity-45')}>{children}</div>
    </div>
  )
}

export default function BulkEditExpensesModal({
  isOpen,
  selectedExpenses,
  categories,
  payees,
  onClose,
  onApply,
  refreshCategories,
  refreshPayees,
}: BulkEditExpensesModalProps) {
  const [applyDate, setApplyDate] = useState(false)
  const [applyPayee, setApplyPayee] = useState(false)
  const [applyCategory, setApplyCategory] = useState(false)
  const [applyNotes, setApplyNotes] = useState(false)
  const [date, setDate] = useState('')
  const [payeeId, setPayeeId] = useState<number | undefined>(undefined)
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPayeePicker, setShowPayeePicker] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  )

  const activeCategories = useMemo(
    () => categories.filter((category) => !category.isArchived),
    [categories],
  )
  const activePayees = useMemo(() => payees.filter((payee) => !payee.isArchived), [payees])
  const payeeOptions = useMemo(
    () =>
      activePayees.map((payee) => ({
        id: payee.id as number,
        label: payee.name,
      })),
    [activePayees],
  )
  const categoryOptions = useMemo(
    () =>
      activeCategories.map((category) => ({
        id: category.id as number,
        label: category.name,
      })),
    [activeCategories],
  )
  const selectedPayeeName = payeeOptions.find((option) => option.id === payeeId)?.label
  const selectedCategoryName = categoryOptions.find((option) => option.id === categoryId)?.label

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth < 640)
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const firstExpense = selectedExpenses[0]
    setApplyDate(false)
    setApplyPayee(false)
    setApplyCategory(false)
    setApplyNotes(false)
    setDate(firstExpense?.date ?? '')
    setPayeeId(firstExpense?.payeeId)
    setCategoryId(firstExpense?.categoryId)
    setNotes(firstExpense?.notes ?? '')
    setError('')
    setSaving(false)
  }, [isOpen, selectedExpenses])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const changes: Partial<Expense> = {}
    if (applyDate) {
      if (!date) {
        setError('Choose a date to apply.')
        return
      }
      changes.date = date
    }
    if (applyPayee) {
      changes.payeeId = payeeId
    }
    if (applyCategory) {
      changes.categoryId = categoryId
    }
    if (applyNotes) {
      changes.notes = notes.trim()
    }

    if (Object.keys(changes).length === 0) {
      setError('Select at least one field to update.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onApply(changes)
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Failed to update expenses.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (saving) return
        onClose()
      }}
      title={`Edit ${selectedExpenses.length} Expenses`}
      size="lg"
      mobileFullScreen
      footer={
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-cancel-sm hidden flex-1 sm:inline-flex"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="bulk-edit-expenses-form"
            disabled={saving}
            className="btn-modal-primary flex-1"
          >
            {saving ? 'Saving...' : 'Apply Changes'}
          </button>
        </ModalFooter>
      }
    >
      <form id="bulk-edit-expenses-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-theme-muted">
          Apply the same values to the selected expenses. Only checked fields will change.
        </p>

        {error && <p className="text-sm text-theme-danger">{error}</p>}

        <BulkEditField checked={applyDate} label="Date" onToggle={setApplyDate}>
          <DatePicker
            value={date}
            onChange={setDate}
            variant="inline"
            inputStyle="default"
            placeholder="Select date..."
          />
        </BulkEditField>

        <BulkEditField checked={applyPayee} label="Payee" onToggle={setApplyPayee}>
          {isMobileViewport ? (
            <>
              <SingleSelectTrigger
                value={selectedPayeeName}
                placeholder="Select payee..."
                isOpen={showPayeePicker}
                onClick={() => setShowPayeePicker(true)}
              />
              <MobileEntityPicker
                open={showPayeePicker}
                title="Select Payee"
                value={payeeId}
                options={payeeOptions}
                placeholder="Search payees..."
                emptyMessage="No payees found."
                createHint="Type a new payee name to add it."
                allowCreate
                allowClear
                clearLabel="No payee"
                onChange={(id) => setPayeeId(id != null ? Number(id) : undefined)}
                onCreate={async (name) => {
                  const newId = await StorageService.addPayee(name)
                  if (newId == null) throw new Error('Failed to create payee')
                  await refreshPayees?.()
                  return newId
                }}
                onClose={() => setShowPayeePicker(false)}
              />
            </>
          ) : (
            <DesktopDropdown
              value={payeeId}
              options={payeeOptions}
              placeholder="Select payee..."
              emptyMessage="No payees found."
              createHint="Type a new payee name to add it."
              allowCreate
              allowClear
              clearLabel="No payee"
              onChange={(id) => setPayeeId(id != null ? Number(id) : undefined)}
              onCreate={async (name) => {
                const newId = await StorageService.addPayee(name)
                if (newId == null) throw new Error('Failed to create payee')
                await refreshPayees?.()
                return newId
              }}
            />
          )}
        </BulkEditField>

        <BulkEditField checked={applyCategory} label="Category" onToggle={setApplyCategory}>
          {isMobileViewport ? (
            <>
              <SingleSelectTrigger
                value={selectedCategoryName}
                placeholder="Select category..."
                isOpen={showCategoryPicker}
                onClick={() => setShowCategoryPicker(true)}
              />
              <MobileEntityPicker
                open={showCategoryPicker}
                title="Select Category"
                value={categoryId}
                options={categoryOptions}
                placeholder="Search categories..."
                emptyMessage="No categories found."
                createHint="Type a new category name to add it."
                allowCreate
                allowClear
                clearLabel="No category"
                onChange={(id) => setCategoryId(id != null ? Number(id) : undefined)}
                onCreate={async (name) => {
                  const newId = await StorageService.addCategory(name)
                  if (newId == null) throw new Error('Failed to create category')
                  await refreshCategories?.()
                  return newId
                }}
                onClose={() => setShowCategoryPicker(false)}
              />
            </>
          ) : (
            <DesktopDropdown
              value={categoryId}
              options={categoryOptions}
              placeholder="Select category..."
              emptyMessage="No categories found."
              createHint="Type a new category name to add it."
              allowCreate
              allowClear
              clearLabel="No category"
              onChange={(id) => setCategoryId(id != null ? Number(id) : undefined)}
              onCreate={async (name) => {
                const newId = await StorageService.addCategory(name)
                if (newId == null) throw new Error('Failed to create category')
                await refreshCategories?.()
                return newId
              }}
            />
          )}
        </BulkEditField>

        <BulkEditField checked={applyNotes} label="Notes" onToggle={setApplyNotes}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Enter notes..."
            className="input-md w-full resize-none"
          />
          <p className="mt-2 text-xs text-theme-muted">
            Leave blank to clear the notes on all selected expenses.
          </p>
        </BulkEditField>
      </form>
    </Modal>
  )
}
