import type { Category, Expense, Payee, Tag } from '../../types'
import type { ExpenseDisplayRow, SplitContainerRowModel } from './splitDisplayRows'
import { getStableTagIdentity, getTagSummaryData } from './tagSummaryChip'

export type SortableExpenseColumnId =
  | 'date'
  | 'payee'
  | 'category'
  | 'notes'
  | 'tags'
  | 'amount'

export type SortDirection = 'asc' | 'desc'

export interface ExpenseTableSort {
  columnId: SortableExpenseColumnId
  direction: SortDirection
}

interface SortGroup {
  rows: ExpenseDisplayRow[]
  index: number
}

function getSplitPayeeLabel(
  rowData: SplitContainerRowModel,
  payeeMap: Record<number, Payee>,
): string {
  const splitPayeeId = rowData.split?.payeeId
  if (typeof splitPayeeId === 'number') {
    return payeeMap[splitPayeeId]?.name ?? rowData.split?.payeeNameSnapshot?.trim() ?? 'No payee'
  }

  const snapshot = rowData.split?.payeeNameSnapshot?.trim()
  if (snapshot) return snapshot

  return rowData.payeeDisplay
}

function getSplitContainerTags(
  rowData: SplitContainerRowModel,
  expenseTagsMap: Record<number, Tag[]>,
): Tag[] {
  const dedupedTags: Tag[] = []
  const seenTagKeys = new Set<string>()

  rowData.childExpenses.forEach((expense) => {
    if (typeof expense.id !== 'number') return
    const tags = expenseTagsMap[expense.id] ?? []
    tags.forEach((tag) => {
      const tagKey = getStableTagIdentity(tag)
      if (seenTagKeys.has(tagKey)) return
      seenTagKeys.add(tagKey)
      dedupedTags.push(tag)
    })
  })

  return dedupedTags
}

function getPayeeSortLabel(expense: Expense, payeeMap: Record<number, Payee>): string {
  if (typeof expense.payeeId !== 'number') return 'No payee'
  return payeeMap[expense.payeeId]?.name ?? 'No payee'
}

function getCategorySortLabel(expense: Expense, catMap: Record<number, Category>): string {
  const activeCategory = catMap[expense.categoryId as number]
  if (!activeCategory) return 'No category'
  return activeCategory.isArchived ? `${activeCategory.name} (deleted)` : activeCategory.name
}

function getTagSortLabel(tags: Tag[]): string {
  return getTagSummaryData(tags).summary ?? ''
}

function getRowSortValue(
  row: ExpenseDisplayRow,
  columnId: SortableExpenseColumnId,
  _formatDate: (iso: string) => string,
  catMap: Record<number, Category>,
  payeeMap: Record<number, Payee>,
  expenseTagsMap: Record<number, Tag[]>,
): number | string {
  switch (columnId) {
    case 'amount':
      return row.rowType === 'splitContainer' ? row.split?.amount ?? row.amountDisplay ?? 0 : row.expense.amount ?? 0
    case 'date': {
      const dateValue =
        row.rowType === 'splitContainer' ? row.split?.date ?? row.childExpenses[0]?.date ?? '' : row.expense.date
      return dateValue
    }
    case 'payee':
      return row.rowType === 'splitContainer'
        ? getSplitPayeeLabel(row, payeeMap)
        : getPayeeSortLabel(row.expense, payeeMap)
    case 'category':
      return row.rowType === 'splitContainer' ? 'Split' : getCategorySortLabel(row.expense, catMap)
    case 'notes':
      return row.rowType === 'splitContainer' ? row.split?.notes ?? '' : row.expense.notes ?? ''
    case 'tags':
      return row.rowType === 'splitContainer'
        ? getTagSortLabel(getSplitContainerTags(row, expenseTagsMap))
        : getTagSortLabel(typeof row.expense.id === 'number' ? (expenseTagsMap[row.expense.id] ?? []) : [])
  }
}

function compareValues(
  left: number | string,
  right: number | string,
  direction: SortDirection,
): number {
  const modifier = direction === 'asc' ? 1 : -1

  if (typeof left === 'number' && typeof right === 'number') {
    return (left - right) * modifier
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  }) * modifier
}

function groupDisplayRows(rows: ExpenseDisplayRow[]): SortGroup[] {
  const groups: SortGroup[] = []

  rows.forEach((row) => {
    if (row.rowType === 'splitChild') {
      const lastGroup = groups[groups.length - 1]
      if (lastGroup) {
        lastGroup.rows.push(row)
      }
      return
    }

    groups.push({
      rows: [row],
      index: groups.length,
    })
  })

  return groups
}

export function sortExpenseDisplayRows(params: {
  rows: ExpenseDisplayRow[]
  sort: ExpenseTableSort | null
  formatDate: (iso: string) => string
  catMap: Record<number, Category>
  payeeMap: Record<number, Payee>
  expenseTagsMap: Record<number, Tag[]>
}): ExpenseDisplayRow[] {
  const { rows, sort, formatDate, catMap, payeeMap, expenseTagsMap } = params

  if (!sort) return rows

  return groupDisplayRows(rows)
    .slice()
    .sort((leftGroup, rightGroup) => {
      const leftValue = getRowSortValue(
        leftGroup.rows[0],
        sort.columnId,
        formatDate,
        catMap,
        payeeMap,
        expenseTagsMap,
      )
      const rightValue = getRowSortValue(
        rightGroup.rows[0],
        sort.columnId,
        formatDate,
        catMap,
        payeeMap,
        expenseTagsMap,
      )
      const result = compareValues(leftValue, rightValue, sort.direction)
      return result !== 0 ? result : leftGroup.index - rightGroup.index
    })
    .flatMap((group) => group.rows)
}
