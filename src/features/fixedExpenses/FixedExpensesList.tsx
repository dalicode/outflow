import { useState } from 'react'
import PrivateValue from '../../components/privacy/PrivateValue'
import { useSettings } from '../../context/settingsContext'
import type { FixedExpense } from '../../types'
import FixedExpenseManagerModal from './FixedExpenseManagerModal'

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
  const { formatAmount } = useSettings()
  const [showManageModal, setShowManageModal] = useState(false)

  const activeItems = items.filter((i) => !i.isArchived)
  const total = activeItems.reduce((s, i) => s + i.amount, 0)

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
                    <PrivateValue>{formatAmount(total)}</PrivateValue>
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

        <FixedExpenseManagerModal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
          items={items}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
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
              <PrivateValue>{formatAmount(total)}</PrivateValue>
              <span className="text-sm font-normal text-theme-muted ml-1">/mo</span>
            </p>
          ) : (
            <p className="text-sm text-theme-muted">None set — tap to add</p>
          )}
        </div>
        <button
          onClick={() => setShowManageModal(true)}
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
          onClick={() => setShowManageModal(true)}
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
                onClick={() => setShowManageModal(true)}
                data-testid={`btn-edit-fixed-expense-${item.id}`}
                className="flex w-full items-center justify-between gap-3 rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2.5 text-left transition-colors hover:border-theme-primary/40"
                aria-label={`Edit ${item.name}`}
              >
                <span className="text-sm font-medium text-theme-text truncate">{item.name}</span>
                <span className="text-sm font-semibold text-theme-text tabular-nums shrink-0">
                  <PrivateValue>{formatAmount(item.amount)}</PrivateValue>
                  <span className="text-xs font-normal text-theme-muted ml-1">/mo</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <FixedExpenseManagerModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        items={items}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  )
}
