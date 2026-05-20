import { describe, expect, it } from 'vitest'
import type { Expense } from '../types'
import {
  compareExpensesByDateAscThenIdAsc,
  compareExpensesByDateDescThenIdAsc,
} from '../utils/expenseOrdering'

const sameDayExpenses: Expense[] = [
  { id: 9, date: '2026-05-19', amount: 10 },
  { id: 2, date: '2026-05-19', amount: 20 },
  { id: 5, date: '2026-05-19', amount: 30 },
]

describe('expenseOrdering', () => {
  it('keeps same-day expenses in id order for descending date sorts', () => {
    const sorted = [...sameDayExpenses].sort(compareExpensesByDateDescThenIdAsc)

    expect(sorted.map((expense) => expense.id)).toEqual([2, 5, 9])
  })

  it('keeps same-day expenses in id order for ascending date sorts', () => {
    const sorted = [...sameDayExpenses].sort(compareExpensesByDateAscThenIdAsc)

    expect(sorted.map((expense) => expense.id)).toEqual([2, 5, 9])
  })

  it('sorts across days before applying the id tie-breaker', () => {
    const sorted = [
      { id: 4, date: '2026-05-18', amount: 10 },
      { id: 9, date: '2026-05-19', amount: 10 },
      { id: 2, date: '2026-05-19', amount: 10 },
      { id: 1, date: '2026-05-20', amount: 10 },
    ].sort(compareExpensesByDateDescThenIdAsc)

    expect(sorted.map((expense) => `${expense.date}:${expense.id}`)).toEqual([
      '2026-05-20:1',
      '2026-05-19:2',
      '2026-05-19:9',
      '2026-05-18:4',
    ])
  })
})
