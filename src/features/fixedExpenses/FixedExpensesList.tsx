import { type FormEvent, useEffect, useState } from 'react'
import MoneyInput from '../../components/inputs/MoneyInput'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import { useSettings } from '../../context/settingsContext'
import type { FixedExpense } from '../../types'
import { resolveMoneyLocaleConfig } from '../../utils/moneyInput'

const EMPTY = { name: '', amount: '' }

type PendingModalAction =
  | { type: 'add'; returnToManage: boolean }
  | {
      type: 'edit'
      item: FixedExpense
      returnToManage: boolean
    }

interface FixedExpensesListProps {
  items: FixedExpense[]
  onAdd: (item: Omit<FixedExpense, 'id'>) => void
  onUpdate: (id: number, changes: Partial<FixedExpense>) => void
  onDelete: (id: number) => void
  compact?: boolean
  mobileList?: boolean
}

export default function FixedExpensesList({
  items,
  onAdd,
  onUpdate,
  onDelete,
  compact = false,
  mobileList = false,
}: FixedExpensesListProps) {
  const { formatAmount, settings } = useSettings()
  const moneyConfig = resolveMoneyLocaleConfig(settings.currencySymbol)
  const [showModal, setShowModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingModalAction | null>(null)
  const [returnToManageModal, setReturnToManageModal] = useState(false)

  const activeItems = items.filter((i) => !i.isArchived)
  const total = activeItems.reduce((s, i) => s + i.amount, 0)

  const validate = (name: string, amount: string) => {
    if (!name.trim()) return 'Name is required.'
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0)
      return 'Enter a positive amount.'
    return ''
  }

  const restoreManageModal = () => {
    window.setTimeout(() => setShowManageModal(true), 0)
  }

  const openAddModal = (returnToManage = false) => {
    setModalMode('add')
    setEditId(null)
    setForm(EMPTY)
    setError('')
    setReturnToManageModal(returnToManage)
    setShowModal(true)
  }

  const openEditModal = (item: FixedExpense, returnToManage = false) => {
    setModalMode('edit')
    setEditId(item.id as number)
    setForm({ name: item.name, amount: String(item.amount) })
    setError('')
    setReturnToManageModal(returnToManage)
    setShowModal(true)
  }

  const openAdd = () => {
    if (showManageModal) {
      setPendingAction({ type: 'add', returnToManage: true })
      setShowManageModal(false)
      return
    }

    openAddModal()
  }

  const openEdit = (item: FixedExpense) => {
    if (showManageModal) {
      setPendingAction({ type: 'edit', item, returnToManage: true })
      setShowManageModal(false)
      return
    }

    openEditModal(item)
  }

  useEffect(() => {
    if (showManageModal || !pendingAction) return

    const timeoutId = window.setTimeout(() => {
      if (pendingAction.type === 'add') {
        openAddModal(pendingAction.returnToManage)
      } else {
        openEditModal(pendingAction.item, pendingAction.returnToManage)
      }
      setPendingAction(null)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [pendingAction, showManageModal])

  const closeModal = ({ restoreManage = true, clearReturn = true } = {}) => {
    const shouldRestoreManage = restoreManage && returnToManageModal
    setShowModal(false)
    setForm(EMPTY)
    setError('')
    if (clearReturn) setReturnToManageModal(false)
    if (shouldRestoreManage) restoreManageModal()
  }

  const closeDeleteConfirmation = () => {
    const shouldRestoreManage = returnToManageModal
    setConfirmDeleteId(null)
    setReturnToManageModal(false)
    if (shouldRestoreManage) restoreManageModal()
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const err = validate(form.name, form.amount)
    if (err) {
      setError(err)
      return
    }
    if (modalMode === 'add') {
      onAdd({ name: form.name.trim(), amount: parseFloat(form.amount) })
    } else if (editId != null) {
      onUpdate(editId, {
        name: form.name.trim(),
        amount: parseFloat(form.amount),
      })
    }
    closeModal()
  }

  const fixedExpenseModal = (
    <Modal
      isOpen={showModal}
      onClose={closeModal}
      title={modalMode === 'add' ? 'Add Fixed Expense' : 'Edit Fixed Expense'}
      size="sm"
      footer={
        <ModalFooter>
          <button type="button" onClick={() => closeModal()} className="btn-cancel-sm flex-1">
            Cancel
          </button>
          <button type="submit" form="fixed-expense-form" className="btn-modal-primary flex-1">
            {modalMode === 'add' ? 'Add' : 'Save'}
          </button>
        </ModalFooter>
      }
    >
      <form id="fixed-expense-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-theme-muted">
          Recurring monthly expense like rent or utilities. Applied to all active months
          automatically.
        </p>
        {error && <p className="text-theme-danger text-xs">{error}</p>}
        <label className="flex flex-col gap-1.5 text-sm text-theme-muted">
          Name
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Rent"
            autoFocus
            className="input-md"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-theme-muted">
          Monthly Amount
          <MoneyInput
            value={Number.parseFloat(form.amount || '0')}
            onChange={(amount) => setForm((f) => ({ ...f, amount: amount.toFixed(2) }))}
            currency={moneyConfig.currency}
            locale={moneyConfig.locale}
            size="md"
            showCurrencyCode
          />
        </label>
        {modalMode === 'edit' && editId != null && (
          <div className="border-t border-theme-border pt-4 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-theme-text">Delete fixed expense</span>
              <button
                type="button"
                onClick={() => {
                  closeModal({ restoreManage: false, clearReturn: false })
                  setConfirmDeleteId(editId)
                }}
                data-testid={`btn-delete-fixed-expense-${editId}`}
                className="btn-modal-destructive h-7 px-3 shrink-0"
              >
                Delete
              </button>
            </div>
            <p className="text-xs text-theme-muted">Remove recurring expense going forward.</p>
          </div>
        )}
      </form>
    </Modal>
  )

  const deleteConfirmationModal = (
    <Modal
      isOpen={confirmDeleteId !== null}
      onClose={closeDeleteConfirmation}
      title="Delete Fixed Expense"
      size="sm"
      footer={
        <ModalFooter>
          <button type="button" onClick={closeDeleteConfirmation} className="btn-cancel-sm flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmDeleteId != null) onDelete(confirmDeleteId)
              closeDeleteConfirmation()
            }}
            className="btn-modal-destructive flex-1"
          >
            Delete
          </button>
        </ModalFooter>
      }
    >
      <p className="text-sm text-theme-muted">
        This will remove the fixed expense from your budget. Existing snapshots for past months are
        kept.
      </p>
    </Modal>
  )

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowManageModal(true)}
          className={mobileList ? 'w-full text-left' : 'w-full text-left group'}
          aria-label="Edit fixed expenses"
        >
          <div
            className={
              mobileList
                ? 'flex items-center justify-between gap-3 py-1'
                : 'flex items-start justify-between gap-3'
            }
          >
            <div className={mobileList ? 'min-w-0 flex-1 space-y-0.5' : 'space-y-0.5'}>
              <p
                className={
                  mobileList
                    ? 'text-sm font-medium text-theme-text'
                    : 'text-xs text-theme-muted uppercase tracking-wider'
                }
              >
                Fixed Expenses
              </p>
              {activeItems.length > 0 ? (
                <>
                  <p
                    className={
                      mobileList
                        ? 'text-sm font-semibold text-theme-text tabular-nums'
                        : 'text-base font-semibold text-theme-text tabular-nums'
                    }
                  >
                    {formatAmount(total)}
                    <span className="ml-1 text-xs font-normal text-theme-muted">/mo</span>
                  </p>
                  <p className="text-xs text-theme-muted">
                    {activeItems.length} item{activeItems.length === 1 ? '' : 's'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-theme-muted">None set — tap to add</p>
              )}
            </div>
            {mobileList ? (
              <span className="shrink-0 text-base text-theme-muted" aria-hidden="true">
                ›
              </span>
            ) : (
              <span className="mt-0.5 shrink-0 text-[0.6875rem] font-medium text-theme-primary opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                Edit
              </span>
            )}
          </div>
        </button>

        <Modal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
          title="Fixed Expenses"
          size="sm"
          footer={
            <ModalFooter>
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="btn-cancel-sm flex-1"
              >
                Close
              </button>
              <button type="button" onClick={openAdd} className="btn-modal-primary flex-1">
                Add
              </button>
            </ModalFooter>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-theme-muted">
              Recurring monthly expenses like rent, utilities, and subscriptions.
            </p>
            {activeItems.length === 0 ? (
              <button
                type="button"
                onClick={openAdd}
                className="w-full rounded-theme-medium border border-dashed border-theme-border py-4 text-sm text-theme-muted hover:border-theme-primary hover:text-theme-primary transition-colors"
              >
                Add rent, utilities, subscriptions...
              </button>
            ) : (
              <ul className="space-y-1.5">
                {activeItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      data-testid={`btn-edit-fixed-expense-${item.id}`}
                      className="flex w-full items-center justify-between gap-3 rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2.5 text-left transition-colors hover:border-theme-primary/40"
                      aria-label={`Edit ${item.name}`}
                    >
                      <span className="truncate text-sm font-medium text-theme-text">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-theme-text tabular-nums">
                        {formatAmount(item.amount)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
        {fixedExpenseModal}
        {deleteConfirmationModal}
      </>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header — matches IncomeForm / SavingsForm style */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs text-theme-muted uppercase tracking-wider">Fixed Expenses</p>
          {activeItems.length > 0 ? (
            <p className="text-xl font-bold text-theme-text tabular-nums">
              {formatAmount(total)}
              <span className="text-sm font-normal text-theme-muted ml-1">/mo</span>
            </p>
          ) : (
            <p className="text-sm text-theme-muted">None set — tap to add</p>
          )}
        </div>
        <button
          onClick={openAdd}
          data-testid="btn-add-fixed-expense"
          className="flex items-center gap-1 text-xs font-medium text-theme-primary hover:opacity-80 transition-opacity shrink-0 mt-0.5"
          aria-label="Add fixed expense"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
          </svg>
          Add
        </button>
      </div>

      {/* Empty state */}
      {activeItems.length === 0 && (
        <button
          type="button"
          onClick={openAdd}
          className="w-full rounded-theme-medium border border-dashed border-theme-border py-4 text-sm text-theme-muted hover:border-theme-primary hover:text-theme-primary transition-colors"
        >
          Add rent, utilities, subscriptions…
        </button>
      )}

      {/* Item list — each row tappable to edit, delete icon always visible */}
      {activeItems.length > 0 && (
        <ul className="space-y-1.5">
          {activeItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openEdit(item)}
                data-testid={`btn-edit-fixed-expense-${item.id}`}
                className="flex w-full items-center justify-between gap-3 rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2.5 text-left transition-colors hover:border-theme-primary/40"
                aria-label={`Edit ${item.name}`}
              >
                <span className="text-sm font-medium text-theme-text truncate">{item.name}</span>
                <span className="text-sm font-semibold text-theme-text tabular-nums shrink-0">
                  {formatAmount(item.amount)}
                  <span className="text-xs font-normal text-theme-muted ml-1">/mo</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {fixedExpenseModal}
      {deleteConfirmationModal}
    </div>
  )
}
