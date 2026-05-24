import { useMemo, useState } from 'react'
import { useLongPress } from './hooks/useLongPress'
import type { Expense } from '../../types'
import { cn } from '../../utils/cn'
import type { ExpenseDisplayRow } from './splitDisplayRows'

interface ExpenseTableMobileProps {
  expenses: Expense[]
  displayRows?: ExpenseDisplayRow[]
  selectedIds?: Set<number>
  onToggleSelect?: (id: number) => void
  onCellEdit?: (expense: Expense) => void
  onToggleSplitExpanded?: (splitId: number) => void
  isSplitExpanded?: (splitId: number) => boolean
  onUnsplitSplit?: (splitId: number) => void
  formatDate: (iso: string) => string
  formatAmount: (n: number) => string
  resolveName: (exp: Expense) => string
  resolvePayeeName?: (exp: Expense) => string
  hideCategory?: boolean
}

export default function ExpenseTableMobile({
  expenses,
  displayRows,
  selectedIds,
  onToggleSelect,
  onCellEdit,
  onToggleSplitExpanded,
  isSplitExpanded,
  onUnsplitSplit,
  formatDate,
  formatAmount,
  resolveName,
  resolvePayeeName,
  hideCategory,
}: ExpenseTableMobileProps) {
  const resolvedSelectedIds = selectedIds ?? new Set<number>()
  const resolvedOnToggleSelect = onToggleSelect ?? (() => {})
  const resolvedOnCellEdit = onCellEdit ?? (() => {})
  const resolvedOnToggleSplitExpanded = onToggleSplitExpanded ?? (() => {})
  const resolvedIsSplitExpanded = isSplitExpanded ?? (() => true)
  const resolvedOnUnsplitSplit = onUnsplitSplit ?? (() => {})
  const isInteractive = onToggleSelect != null || onCellEdit != null
  const [openSplitActionId, setOpenSplitActionId] = useState<number | null>(null)

  const groupedExpenses = useMemo(() => {
    if (displayRows && displayRows.length > 0) {
      const groups: Record<string, ExpenseDisplayRow[]> = {}
      displayRows.forEach((row) => {
        let date = ''
        if (row.rowType === 'expense' || row.rowType === 'splitChild') {
          date = row.expense.date
        } else {
          date = row.split?.date ?? row.childExpenses[0]?.date ?? ''
        }
        if (!groups[date]) groups[date] = []
        groups[date].push(row)
      })
      return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
    }

    const groups: Record<string, Expense[]> = {}
    expenses.forEach((exp) => {
      if (!groups[exp.date]) groups[exp.date] = []
      groups[exp.date].push(exp)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [displayRows, expenses])

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
          {items.map((item) => {
            if ('rowType' in item && item.rowType === 'splitContainer') {
              const expanded = resolvedIsSplitExpanded(item.splitId)
              return (
                <div
                  key={item.rowId}
                  className={cn(
                    'border-b border-theme-muted-subtle px-1.5 py-2',
                    'grid grid-cols-[minmax(0,1fr)_6.5rem] grid-rows-[auto_auto] gap-x-3 gap-y-0.5',
                    'bg-theme-background',
                  )}
                >
                  <div className="col-start-1 row-start-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        className="text-xs text-theme-muted"
                        onClick={() => resolvedOnToggleSplitExpanded(item.splitId)}
                      >
                        {expanded ? '▾' : '▸'}
                      </button>
                      <span className="min-w-0 truncate text-sm font-medium text-theme-text">
                        {item.payeeDisplay}
                      </span>
                    </div>
                  </div>
                  <span className="col-start-2 row-span-2 row-start-1 self-center text-right text-sm font-semibold tabular-nums text-theme-text">
                    {formatAmount(item.amountDisplay)}
                  </span>
                  <div className="col-start-1 row-start-2 min-w-0 flex items-center gap-2 text-xs text-theme-muted">
                    <span className="font-medium">Split</span>
                    <span className="truncate">{item.descriptionDisplay}</span>
                    <div className="ml-auto relative">
                      <button
                        type="button"
                        aria-label="Split actions"
                        onClick={() =>
                          setOpenSplitActionId((prev) => (prev === item.splitId ? null : item.splitId))
                        }
                        className="px-1 text-sm text-theme-muted hover:text-theme-text"
                      >
                        ⋮
                      </button>
                      {openSplitActionId === item.splitId && (
                        <div className="absolute right-0 top-6 z-20 min-w-[10rem] rounded-theme-medium border border-theme-border bg-theme-surface shadow-lg">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-theme-text hover:bg-theme-background"
                            onClick={() => {
                              resolvedOnUnsplitSplit(item.splitId)
                              setOpenSplitActionId(null)
                            }}
                          >
                            Unsplit transaction
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            const exp = 'rowType' in item ? item.expense : item
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
