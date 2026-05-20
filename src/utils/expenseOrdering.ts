import type { Expense } from '../types'

function getExpenseId(expense: Expense): number {
  return expense.id ?? Number.MAX_SAFE_INTEGER
}

export function compareExpensesByDateDescThenIdAsc(a: Expense, b: Expense): number {
  return b.date.localeCompare(a.date) || getExpenseId(a) - getExpenseId(b)
}

export function compareExpensesByDateAscThenIdAsc(a: Expense, b: Expense): number {
  return a.date.localeCompare(b.date) || getExpenseId(a) - getExpenseId(b)
}
