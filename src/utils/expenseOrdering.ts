import type { Expense } from '../types'

function getExpenseIdForAscSort(expense: Expense): number {
  return expense.id ?? Number.MAX_SAFE_INTEGER
}

function getExpenseIdForDescSort(expense: Expense): number {
  return expense.id ?? Number.MIN_SAFE_INTEGER
}

export function compareExpensesByDateDescThenIdDesc(a: Expense, b: Expense): number {
  return b.date.localeCompare(a.date) || getExpenseIdForDescSort(b) - getExpenseIdForDescSort(a)
}

export function compareExpensesByDateAscThenIdAsc(a: Expense, b: Expense): number {
  return a.date.localeCompare(b.date) || getExpenseIdForAscSort(a) - getExpenseIdForAscSort(b)
}
