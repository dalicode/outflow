import { forwardRef } from 'react'
import EmptyState from '../../components/ui/EmptyState'
import type { Expense } from '../../types'
import ExpenseTableMobile from './ExpenseTableMobile'

interface ExpenseDrilldownProps {
  title: string
  expenses: Expense[]
  formatDate: (iso: string) => string
  formatAmount: (n: number) => string
  resolveName: (exp: Expense) => string
  resolvePayeeName?: (exp: Expense) => string
  onClose: () => void
  isMobile?: boolean
  secondColumn: 'payee' | 'category'
}

const ExpenseDrilldown = forwardRef<HTMLDivElement, ExpenseDrilldownProps>(
  (
    {
      title,
      expenses,
      formatDate,
      formatAmount,
      resolveName,
      resolvePayeeName,
      onClose,
      isMobile,
      secondColumn,
    },
    ref,
  ) => {
    const closeButtonClassName =
      'rounded-theme-small border border-theme-border px-2 py-1 text-[0.6875rem] font-medium text-theme-muted hover:text-theme-text hover:border-theme-text transition-colors'

    return (
      <div ref={ref} className="space-y-2 border-t border-theme-border pt-4">
        {isMobile ? (
          <>
            <div className="px-1.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-theme-text">{title}</h3>
              <button
                onClick={onClose}
                className={closeButtonClassName}
              >
                Close
              </button>
            </div>
            <ExpenseTableMobile
              expenses={expenses}
              formatDate={formatDate}
              formatAmount={formatAmount}
              resolveName={resolveName}
              resolvePayeeName={resolvePayeeName}
              hideCategory={secondColumn === 'payee'}
            />
          </>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="px-3 pb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-theme-text">{title}</h3>
                <button
                  onClick={onClose}
                  className={closeButtonClassName}
                >
                  Close
                </button>
              </div>
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="table-header-cell text-left">Date</th>
                    <th className="table-header-cell text-left">
                      {secondColumn === 'payee' ? 'Payee' : 'Category'}
                    </th>
                    <th className="table-header-cell text-left">Description</th>
                    <th className="table-header-cell text-right tabular-nums">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="border-b border-theme-muted-subtle row-hover">
                      <td className="px-3 py-1 text-theme-text whitespace-nowrap">
                        {formatDate(exp.date)}
                      </td>
                      <td className="px-3 py-1 text-theme-text whitespace-nowrap">
                        {secondColumn === 'payee'
                          ? resolvePayeeName?.(exp) || '—'
                          : resolveName(exp)}
                      </td>
                      <td className="px-3 py-1 text-theme-text max-w-[200px] truncate">
                        {exp.description || '—'}
                      </td>
                      <td className="px-3 py-1 text-right tabular-nums font-semibold text-theme-text">
                        {formatAmount(exp.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {expenses.length === 0 && <EmptyState message="No expenses" />}
      </div>
    )
  },
)

export default ExpenseDrilldown
