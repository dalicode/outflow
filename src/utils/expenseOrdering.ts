import type { Expense } from '../types'

function getExpenseCreatedAt(expense: Expense): string {
  return expense.createdAt ?? expense.updatedAt ?? ''
}

function getExpenseStableIdentity(expense: Expense): string {
  return expense.localId ?? expense.cloudId ?? ''
}

function getExpenseIdForAscSort(expense: Expense): number {
  return expense.id ?? Number.MAX_SAFE_INTEGER
}

function getExpenseIdForDescSort(expense: Expense): number {
  return expense.id ?? Number.MIN_SAFE_INTEGER
}

export function compareExpensesByDateDescThenIdDesc(a: Expense, b: Expense): number {
  return (
    b.date.localeCompare(a.date) ||
    getExpenseCreatedAt(b).localeCompare(getExpenseCreatedAt(a)) ||
    getExpenseStableIdentity(b).localeCompare(getExpenseStableIdentity(a)) ||
    getExpenseIdForDescSort(b) - getExpenseIdForDescSort(a)
  )
}

export function compareExpensesByDateAscThenIdAsc(a: Expense, b: Expense): number {
  return (
    a.date.localeCompare(b.date) ||
    getExpenseCreatedAt(a).localeCompare(getExpenseCreatedAt(b)) ||
    getExpenseStableIdentity(a).localeCompare(getExpenseStableIdentity(b)) ||
    getExpenseIdForAscSort(a) - getExpenseIdForAscSort(b)
  )
}
