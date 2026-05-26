import { describe, expect, it } from 'vitest'
import type { Expense } from '../types'
import {
  compareExpensesByDateAscThenIdAsc,
  compareExpensesByDateDescThenIdDesc,
} from '../utils/expenseOrdering'

const sameDayExpenses: Expense[] = [
  {
    id: 9,
    localId: 'expense-c',
    createdAt: '2026-05-19T18:00:00.000Z',
    date: '2026-05-19',
    amount: 10,
  },
  {
    id: 2,
    localId: 'expense-a',
    createdAt: '2026-05-19T09:00:00.000Z',
    date: '2026-05-19',
    amount: 20,
  },
  {
    id: 5,
    localId: 'expense-b',
    createdAt: '2026-05-19T12:00:00.000Z',
    date: '2026-05-19',
    amount: 30,
  },
]

describe('expenseOrdering', () => {
  it('keeps same-day expenses in descending createdAt order for descending date sorts', () => {
    const sorted = [...sameDayExpenses].sort(compareExpensesByDateDescThenIdDesc)

    expect(sorted.map((expense) => expense.id)).toEqual([9, 5, 2])
  })

  it('keeps same-day expenses in createdAt order for ascending date sorts', () => {
    const sorted = [...sameDayExpenses].sort(compareExpensesByDateAscThenIdAsc)

    expect(sorted.map((expense) => expense.id)).toEqual([2, 5, 9])
  })

  it('prioritizes date descending before applying the same-day metadata tie-breaker', () => {
    const sorted = [
      { id: 4, localId: 'expense-d', createdAt: '2026-05-18T10:00:00.000Z', date: '2026-05-18', amount: 10 },
      { id: 9, localId: 'expense-b', createdAt: '2026-05-19T12:00:00.000Z', date: '2026-05-19', amount: 10 },
      { id: 2, localId: 'expense-a', createdAt: '2026-05-19T09:00:00.000Z', date: '2026-05-19', amount: 10 },
      { id: 1, localId: 'expense-e', createdAt: '2026-05-20T08:00:00.000Z', date: '2026-05-20', amount: 10 },
    ].sort(compareExpensesByDateDescThenIdDesc)

    expect(sorted.map((expense) => `${expense.date}:${expense.id}`)).toEqual([
      '2026-05-20:1',
      '2026-05-19:9',
      '2026-05-19:2',
      '2026-05-18:4',
    ])
  })

  it('ignores device-specific ids when createdAt and localId already define same-day order', () => {
    const sourceDeviceRows: Expense[] = [
      { id: 101, localId: 'expense-a', createdAt: '2026-05-24T09:00:00.000Z', date: '2026-05-24', amount: 1 },
      { id: 102, localId: 'expense-b', createdAt: '2026-05-24T12:00:00.000Z', date: '2026-05-24', amount: 1 },
      { id: 103, localId: 'expense-c', createdAt: '2026-05-24T18:00:00.000Z', date: '2026-05-24', amount: 1 },
    ]
    const syncedDeviceRows: Expense[] = [
      { id: 8, localId: 'expense-c', createdAt: '2026-05-24T18:00:00.000Z', date: '2026-05-24', amount: 1 },
      { id: 41, localId: 'expense-a', createdAt: '2026-05-24T09:00:00.000Z', date: '2026-05-24', amount: 1 },
      { id: 12, localId: 'expense-b', createdAt: '2026-05-24T12:00:00.000Z', date: '2026-05-24', amount: 1 },
    ]

    expect(sourceDeviceRows.sort(compareExpensesByDateDescThenIdDesc).map((expense) => expense.localId)).toEqual([
      'expense-c',
      'expense-b',
      'expense-a',
    ])
    expect(syncedDeviceRows.sort(compareExpensesByDateDescThenIdDesc).map((expense) => expense.localId)).toEqual([
      'expense-c',
      'expense-b',
      'expense-a',
    ])
  })
})
