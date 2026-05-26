import { useMemo, useRef } from 'react'
import { useLongPress } from './hooks/useLongPress'
import type { Expense, Tag } from '../../types'
import { cn } from '../../utils/cn'
import type { ExpenseDisplayRow } from './splitDisplayRows'
import { getTagSummaryChipStyle, getTagSummaryData } from './tagSummaryChip'

interface ExpenseTableMobileProps {
  expenses: Expense[]
  displayRows?: ExpenseDisplayRow[]
  expenseTagsMap?: Record<number, Tag[]>
  selectedIds?: Set<number>
  onToggleSelect?: (id: number) => void
  onCellEdit?: (expense: Expense) => void
  onToggleSplitExpanded?: (splitId: number) => void
  onSplitParentEdit?: (splitId: number) => void
  onToggleSplitParentSelect?: (splitId: number) => void
  isSplitParentSelected?: (splitId: number) => boolean
  isSplitExpanded?: (splitId: number) => boolean
  formatDate: (iso: string) => string
  formatAmount: (n: number) => string
  resolveName: (exp: Expense) => string
  resolvePayeeName?: (exp: Expense) => string
  hideCategory?: boolean
}

export default function ExpenseTableMobile({
  expenses,
  displayRows,
  expenseTagsMap = {},
  selectedIds,
  onToggleSelect,
  onCellEdit,
  onToggleSplitExpanded,
  onSplitParentEdit,
  isSplitExpanded,
  onToggleSplitParentSelect,
  isSplitParentSelected,
  formatDate,
  formatAmount,
  resolveName,
  resolvePayeeName,
  hideCategory,
}: ExpenseTableMobileProps) {
  const ignoreNextParentClickRef = useRef<number | null>(null)
  const resolvedSelectedIds = selectedIds ?? new Set<number>()
  const resolvedOnToggleSelect = onToggleSelect ?? (() => {})
  const resolvedOnCellEdit = onCellEdit ?? (() => {})
  const resolvedOnToggleSplitExpanded = onToggleSplitExpanded ?? (() => {})
  const resolvedOnSplitParentEdit = onSplitParentEdit ?? (() => {})
  const resolvedOnToggleSplitParentSelect = onToggleSplitParentSelect ?? (() => {})
  const resolvedIsSplitParentSelected = isSplitParentSelected ?? (() => false)
  const resolvedIsSplitExpanded = isSplitExpanded ?? (() => true)
  const isInteractive =
    onToggleSelect != null ||
    onCellEdit != null ||
    onToggleSplitParentSelect != null ||
    onSplitParentEdit != null

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
      if (id < 0) {
        const splitId = -(id + 1)
        resolvedOnToggleSplitParentSelect(splitId)
        return
      }
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
                  data-testid={`split-container-mobile-${item.splitId}`}
                  className={cn(
                    'border-b border-theme-muted-subtle px-2.5 py-2',
                    'grid grid-cols-[minmax(0,1fr)_6.5rem] grid-rows-[auto_auto] gap-x-3 gap-y-0.5',
                    resolvedIsSplitParentSelected(item.splitId) &&
                      'selected-row bg-theme-primary-subtle shadow-[inset_4px_0_0_var(--theme-primary)]',
                  )}
                  onTouchStart={
                    isInteractive ? (e) => onTouchStart(e, -(item.splitId + 1)) : undefined
                  }
                  onTouchMove={isInteractive ? onTouchMove : undefined}
                  onTouchEnd={
                    isInteractive
                      ? (e) => {
                          onTouchEnd(e, -(item.splitId + 1))
                          if (!e.defaultPrevented) {
                            const target = e.target as HTMLElement | null
                            if (target?.closest('[data-split-expand="true"]')) return
                            if (resolvedSelectedIds.size > 0) {
                              ignoreNextParentClickRef.current = item.splitId
                              resolvedOnToggleSplitParentSelect(item.splitId)
                            }
                          }
                        }
                      : undefined
                  }
                  onClick={(e) => {
                    if (!isInteractive) return
                    const target = e.target as HTMLElement | null
                    if (target?.closest('[data-split-expand="true"]')) return
                    if (ignoreNextParentClickRef.current === item.splitId) {
                      ignoreNextParentClickRef.current = null
                      return
                    }
                    if (resolvedSelectedIds.size > 0) {
                      resolvedOnToggleSplitParentSelect(item.splitId)
                      return
                    }
                    resolvedOnSplitParentEdit(item.splitId)
                  }}
                >
                  <div className="col-start-1 row-start-1 min-w-0">
                    <span className="block min-w-0 truncate text-sm font-medium text-theme-muted">
                      {item.payeeDisplay}
                    </span>
                  </div>
                  <span className="col-start-2 row-span-2 row-start-1 self-center text-right text-sm font-semibold tabular-nums text-theme-text">
                    {formatAmount(item.amountDisplay)}
                  </span>
                  <div className="col-start-1 row-start-2 min-w-0 flex items-center gap-2 text-xs text-theme-muted">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      data-split-expand="true"
                      className="inline-flex shrink-0 items-center gap-2 text-left text-theme-muted"
                      onClick={() => resolvedOnToggleSplitExpanded(item.splitId)}
                    >
                      <span className="text-xs text-theme-muted">{expanded ? '▾' : '▸'}</span>
                      <span className="font-medium text-theme-muted">Split</span>
                    </button>
                    {item.notesDisplay ? (
                      <span className="min-w-0 truncate">{item.notesDisplay}</span>
                    ) : null}
                    <span className="ml-auto" />
                  </div>
                </div>
              )
            }

            const exp = 'rowType' in item ? item.expense : item
            const isSelected = resolvedSelectedIds.has(exp.id as number)
            const isSplitChildRow = 'rowType' in item && item.rowType === 'splitChild'
            const payeeLabel = isSplitChildRow ? '' : resolvePayeeName?.(exp) || '—'
            const categoryLabel = hideCategory ? '' : resolveName(exp)
            const detailLabel =
              categoryLabel && exp.notes
                ? `${categoryLabel} · ${exp.notes}`
                : categoryLabel || exp.notes || ''
            const tags = expenseTagsMap[exp.id as number] ?? []
            const { primaryTag, summary } = getTagSummaryData(tags)
            return (
              <div
                key={exp.id}
                data-testid={`expense-row-mobile-${exp.id}`}
                className={cn(
                  'expense-row-mobile border-b border-theme-muted-subtle px-2.5 py-2',
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
                <span
                  className={cn(
                    'col-start-1 row-start-1 min-w-0 truncate text-sm font-medium text-theme-text',
                    isSplitChildRow && 'pl-5',
                  )}
                >
                  {payeeLabel}
                </span>
                <span className="col-start-2 row-span-2 row-start-1 self-center text-right text-sm font-semibold tabular-nums text-theme-text">
                  {formatAmount(exp.amount)}
                </span>
                <div
                  className={cn(
                    'col-start-1 row-start-2 min-w-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 text-xs text-theme-muted',
                    isSplitChildRow && 'pl-5',
                  )}
                >
                  <span className="min-w-0 truncate">{detailLabel || '—'}</span>
                  {primaryTag ? (
                    <span
                      className={cn(
                        'inline-flex min-w-0 max-w-full items-center rounded-theme-small border px-1.5 py-0.5 text-[11px] leading-tight',
                        primaryTag.isArchived && 'italic',
                      )}
                      style={getTagSummaryChipStyle(primaryTag)}
                      title={summary}
                    >
                      <span className="truncate">{summary}</span>
                    </span>
                  ) : isSplitChildRow ? (
                    <span />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
