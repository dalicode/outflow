import type { Expense, ExpenseSplit, Payee } from '../../types'

export interface ExpenseRowModel {
  rowType: 'expense'
  rowId: string
  expense: Expense
}

export interface SplitContainerRowModel {
  rowType: 'splitContainer'
  rowId: string
  splitId: number
  split: ExpenseSplit | null
  childExpenses: Expense[]
  payeeDisplay: string
  notesDisplay: string
  amountDisplay: number
}

export interface SplitChildRowModel {
  rowType: 'splitChild'
  rowId: string
  splitId: number
  expense: Expense
}

export type ExpenseDisplayRow = ExpenseRowModel | SplitContainerRowModel | SplitChildRowModel

export function getEffectiveSplitParentExpanded(params: {
  splitId: number
  defaultExpanded: boolean
  overrides: Record<number, boolean>
}): boolean {
  const { splitId, defaultExpanded, overrides } = params
  const override = overrides[splitId]
  return typeof override === 'boolean' ? override : defaultExpanded
}

function getPayeeName(payeeId: number | undefined, payeeMap: Record<number, Payee>): string {
  if (typeof payeeId !== 'number') return 'No payee'
  return payeeMap[payeeId]?.name ?? 'No payee'
}

export function getSplitContainerPayeeDisplay(
  children: Expense[],
  payeeMap: Record<number, Payee>,
): string {
  if (children.length === 0) return 'No payee'

  const byPayee = new Map<number | 'none', { count: number; total: number; label: string }>()
  for (const child of children) {
    const key = typeof child.payeeId === 'number' ? child.payeeId : 'none'
    const current = byPayee.get(key)
    if (current) {
      current.count += 1
      current.total += Math.abs(child.amount ?? 0)
      continue
    }
    byPayee.set(key, {
      count: 1,
      total: Math.abs(child.amount ?? 0),
      label: getPayeeName(child.payeeId, payeeMap),
    })
  }

  const ranked = Array.from(byPayee.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    if (b.total !== a.total) return b.total - a.total
    return a.label.localeCompare(b.label)
  })

  const winner = ranked[0]
  const remaining = ranked.length - 1
  if (remaining <= 0) return winner.label
  return `${winner.label} (+${remaining} more)`
}

export function buildExpenseDisplayRows(params: {
  expenses: Expense[]
  splits: ExpenseSplit[]
  payeeMap: Record<number, Payee>
  expandedSplitIds: Set<number>
}): ExpenseDisplayRow[] {
  const { expenses, splits, payeeMap, expandedSplitIds } = params

  const splitMap = new Map<number, ExpenseSplit>()
  for (const split of splits) {
    if (typeof split.id === 'number') {
      splitMap.set(split.id, split)
    }
  }

  const childrenBySplitId = new Map<number, Expense[]>()
  for (const expense of expenses) {
    if (typeof expense.splitId !== 'number') continue
    const existing = childrenBySplitId.get(expense.splitId)
    if (existing) {
      existing.push(expense)
    } else {
      childrenBySplitId.set(expense.splitId, [expense])
    }
  }

  const addedSplitIds = new Set<number>()
  const rows: ExpenseDisplayRow[] = []

  for (const expense of expenses) {
    if (typeof expense.splitId !== 'number') {
      rows.push({
        rowType: 'expense',
        rowId: `expense-row-${expense.id}`,
        expense,
      })
      continue
    }

    const splitId = expense.splitId
    if (addedSplitIds.has(splitId)) continue
    addedSplitIds.add(splitId)

    const children = childrenBySplitId.get(splitId) ?? []
    const split = splitMap.get(splitId) ?? null

    rows.push({
      rowType: 'splitContainer',
      rowId: `split-container-${splitId}`,
      splitId,
      split,
      childExpenses: children,
      payeeDisplay: getSplitContainerPayeeDisplay(children, payeeMap),
      notesDisplay: split?.notes ?? '',
      amountDisplay: children.reduce((sum, child) => sum + (child.amount ?? 0), 0),
    })

    if (!expandedSplitIds.has(splitId)) continue
    for (const child of children) {
      rows.push({
        rowType: 'splitChild',
        rowId: `split-child-${child.id}`,
        splitId,
        expense: child,
      })
    }
  }

  return rows
}
