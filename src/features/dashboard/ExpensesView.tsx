import { forwardRef } from 'react'
import type { Category, Expense, Payee } from '../../types'
import { cn } from '../../utils/cn'
import ExpenseTable from './ExpenseTable'

interface ExpensesViewProps {
  expenses: Expense[]
  categories: Category[]
  payees: Payee[]
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  onBulkDelete: () => void
  onUpdate: (id: number, changes: Partial<Expense>) => Promise<void>
  onDelete: (id: number) => Promise<void>
  isMobile: boolean
  mobileEditTrigger: number | null
  viewAnimation: 'slide-left' | 'slide-right' | null
  refreshCategories?: () => Promise<void>
  refreshPayees?: () => Promise<void>
  refreshExpenses?: () => Promise<void>
  triggerSync?: () => void
  onMobileExtraMenuActionsChange?: (
    actions: Array<{ label: string; onClick: () => void; danger?: boolean }>,
  ) => void
}

const ExpensesView = forwardRef<React.ComponentRef<typeof ExpenseTable>, ExpensesViewProps>(
  function ExpensesView(
    {
      expenses,
      categories,
      payees,
      selectedIds,
      onToggleSelect,
      onToggleSelectAll,
      onBulkDelete,
      onUpdate,
      onDelete,
      isMobile,
      mobileEditTrigger,
      viewAnimation,
      refreshCategories,
      refreshPayees,
      refreshExpenses,
      triggerSync,
      onMobileExtraMenuActionsChange,
    },
    ref,
  ) {
    return (
      <div
        className={cn(
          viewAnimation === 'slide-left' && 'view-slide-left',
          viewAnimation === 'slide-right' && 'view-slide-right',
        )}
      >
        <ExpenseTable
          ref={ref}
          expenses={expenses}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onBulkDelete={onBulkDelete}
          categories={categories}
          payees={payees}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onToggleSelectAll={onToggleSelectAll}
          isMobile={isMobile}
          mobileEditTrigger={mobileEditTrigger}
          refreshCategories={refreshCategories}
          refreshPayees={refreshPayees}
          refreshExpenses={refreshExpenses}
          triggerSync={triggerSync}
          onMobileExtraMenuActionsChange={onMobileExtraMenuActionsChange}
        />
      </div>
    )
  },
)

export default ExpensesView
