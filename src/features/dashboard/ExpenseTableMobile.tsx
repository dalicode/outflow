import { useMemo } from 'react'
import { useLongPress } from './hooks/useLongPress'
import type { Expense } from '../../types'
import { cn } from '../../utils/cn'

interface ExpenseTableMobileProps {
  expenses: Expense[]
  selectedIds?: Set<number>
  onToggleSelect?: (id: number) => void
  onCellEdit?: (expense: Expense) => void
  formatDate: (iso: string) => string
  formatAmount: (n: number) => string
  resolveName: (exp: Expense) => string
  resolvePayeeName?: (exp: Expense) => string
  hideCategory?: boolean
}

export default function ExpenseTableMobile({
  expenses,
  selectedIds,
  onToggleSelect,
  onCellEdit,
  formatDate,
  formatAmount,
  resolveName,
  resolvePayeeName,
  hideCategory,
}: ExpenseTableMobileProps) {
  const resolvedSelectedIds = selectedIds ?? new Set<number>()
  const resolvedOnToggleSelect = onToggleSelect ?? (() => {})
  const resolvedOnCellEdit = onCellEdit ?? (() => {})
  const isInteractive = onToggleSelect != null || onCellEdit != null

  const groupedExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {}
    expenses.forEach((exp) => {
      if (!groups[exp.date]) groups[exp.date] = []
      groups[exp.date].push(exp)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [expenses])

  const { onTouchStart, onTouchMove, onTouchEnd } = useLongPress({
    onLongPress: (id: number) => {
      resolvedOnToggleSelect(id)
    },
  })

  return (
    <div>
      {groupedExpenses.map(([date, items]) => (
        <div key={date}>
          <div className="px-1.5 py-2 text-xs text-theme-muted bg-theme-background border-b border-theme-muted-subtle">
            {formatDate(date)}
          </div>
          {items.map((exp) => {
            const isSelected = resolvedSelectedIds.has(exp.id as number)
            const payeeLabel = resolvePayeeName?.(exp) || '—'
            const categoryLabel = hideCategory ? '' : resolveName(exp)
            const detailLabel =
              categoryLabel && exp.description
                ? `${categoryLabel} · ${exp.description}`
                : categoryLabel || exp.description || ''
            return (
              <div
                key={exp.id}
                data-testid={`expense-row-mobile-${exp.id}`}
                className={cn(
                  'expense-row-mobile border-b border-theme-muted-subtle px-1.5 py-2',
                  'grid grid-cols-[minmax(0,1fr)_6.5rem] grid-rows-[auto_auto] gap-x-3 gap-y-0.5',
                  isSelected &&
                    'selected-row bg-theme-primary-subtle shadow-[inset_4px_0_0_var(--theme-primary)]',
                  'row-hover',
                )}
                onTouchStart={isInteractive ? (e) => onTouchStart(e, exp.id as number) : undefined}
                onTouchMove={isInteractive ? onTouchMove : undefined}
                onTouchEnd={isInteractive ? (e) => onTouchEnd(e, exp.id as number) : undefined}
                onClick={() => {
                  if (!isInteractive) return
                  if (resolvedSelectedIds.size > 0) {
                    resolvedOnToggleSelect(exp.id as number)
                  } else {
                    resolvedOnCellEdit(exp)
                  }
                }}
              >
                <span className="col-start-1 row-start-1 min-w-0 truncate text-sm font-medium text-theme-text">
                  {payeeLabel}
                </span>
                <span className="col-start-2 row-span-2 row-start-1 self-center text-right text-sm font-semibold tabular-nums text-theme-text">
                  {formatAmount(exp.amount)}
                </span>
                <span className="col-start-1 row-start-2 min-w-0 truncate text-xs text-theme-muted">
                  {detailLabel || '—'}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
