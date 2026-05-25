import type { Expense } from '../types'

export interface ExpenseAllocation {
  expenseId?: number
  splitId?: number
  date: string
  amount: number
  categoryId?: number
  payeeId?: number
  notes?: string
}

export function getExpenseAllocations(expenses: Expense[]): ExpenseAllocation[] {
  return (expenses || []).map((expense) => ({
    expenseId: expense.id,
    splitId: expense.splitId,
    date: expense.date,
    amount: expense.amount || 0,
    categoryId: expense.categoryId,
    payeeId: expense.payeeId,
    notes: expense.notes,
  }))
}
