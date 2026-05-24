import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, resetState, dbMock } = vi.hoisted(() => {
  const state = {
    expenses: [] as Array<Record<string, unknown>>,
    categories: new Map<number, Record<string, unknown>>(),
    payees: new Map<number, Record<string, unknown>>(),
    categoryMergeHistory: new Map<number, Record<string, unknown>>(),
    payeeMergeHistory: new Map<number, Record<string, unknown>>(),
    expenseSplits: [] as Array<Record<string, unknown>>,
  }

  const resetState = () => {
    state.expenses = []
    state.categories.clear()
    state.payees.clear()
    state.categoryMergeHistory.clear()
    state.payeeMergeHistory.clear()
    state.expenseSplits = []
  }

  const dbMock = {
    expenses: {
      bulkGet: vi.fn(async (ids: number[]) =>
        ids.map((id) => state.expenses.find((expense) => expense.id === id)),
      ),
      bulkPut: vi.fn(async (rows: Array<Record<string, unknown>>) => {
        for (const row of rows) {
          const index = state.expenses.findIndex((expense) => expense.id === row.id)
          if (index >= 0) {
            state.expenses[index] = row
          } else {
            state.expenses.push(row)
          }
        }
      }),
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: unknown) => ({
          toArray: vi.fn(async () => state.expenses.filter((expense) => expense[field] === value)),
        })),
      })),
    },
    categories: {
      get: vi.fn(async (id: number) => state.categories.get(id)),
      put: vi.fn(async (row: Record<string, unknown>) => {
        state.categories.set(row.id as number, row)
        return row.id as number
      }),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => []),
        })),
      })),
    },
    payees: {
      get: vi.fn(async (id: number) => state.payees.get(id)),
      put: vi.fn(async (row: Record<string, unknown>) => {
        state.payees.set(row.id as number, row)
        return row.id as number
      }),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => []),
        })),
      })),
    },
    categoryMergeHistory: {
      get: vi.fn(async (id: number) => state.categoryMergeHistory.get(id)),
      put: vi.fn(async (row: Record<string, unknown>) => {
        state.categoryMergeHistory.set(row.id as number, row)
        return row.id as number
      }),
      add: vi.fn(async () => 1),
    },
    payeeMergeHistory: {
      get: vi.fn(async (id: number) => state.payeeMergeHistory.get(id)),
      put: vi.fn(async (row: Record<string, unknown>) => {
        state.payeeMergeHistory.set(row.id as number, row)
        return row.id as number
      }),
      add: vi.fn(async (row: Record<string, unknown>) => {
        const id = 1
        state.payeeMergeHistory.set(id, { ...row, id })
        return id
      }),
    },
    expenseSplits: {
      bulkGet: vi.fn(async (ids: number[]) =>
        ids.map((id) => state.expenseSplits.find((split) => split.id === id)),
      ),
      bulkPut: vi.fn(async (rows: Array<Record<string, unknown>>) => {
        for (const row of rows) {
          const index = state.expenseSplits.findIndex((split) => split.id === row.id)
          if (index >= 0) {
            state.expenseSplits[index] = row
          } else {
            state.expenseSplits.push(row)
          }
        }
      }),
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: unknown) => ({
          toArray: vi.fn(async () => state.expenseSplits.filter((split) => split[field] === value)),
        })),
      })),
    },
  }

  return { state, resetState, dbMock }
})

vi.mock('../services/db/schema', () => ({
  default: dbMock,
}))

import { revertCategoryMerge } from '../services/repositories/categoryRepository'
import { mergePayee, revertPayeeMerge } from '../services/repositories/payeeRepository'

describe('merge revert snapshot restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })

  it('restores categoryId and categoryNameSnapshot when reverting a category merge', async () => {
    state.categories.set(1, {
      id: 1,
      name: 'Food',
      deletedAt: null,
    })
    state.categoryMergeHistory.set(100, {
      id: 100,
      sourceCategoryId: 1,
      targetCategoryId: 2,
      affectedExpenseIds: [10],
      revertedAt: null,
      deletedAt: null,
    })
    state.expenses.push({
      id: 10,
      categoryId: 2,
      categoryNameSnapshot: 'Dining Out',
      deletedAt: null,
    })

    await revertCategoryMerge(100)

    expect(state.expenses[0].categoryId).toBe(1)
    expect(state.expenses[0].categoryNameSnapshot).toBe('Food')
  })

  it('restores payeeId and payeeNameSnapshot when reverting a payee merge', async () => {
    state.payees.set(3, {
      id: 3,
      name: 'Cafe',
      deletedAt: null,
    })
    state.payeeMergeHistory.set(200, {
      id: 200,
      sourcePayeeId: 3,
      targetPayeeId: 4,
      affectedExpenseIds: [20],
      revertedAt: null,
      deletedAt: null,
    })
    state.expenses.push({
      id: 20,
      payeeId: 4,
      payeeNameSnapshot: 'Coffee House',
      deletedAt: null,
    })

    await revertPayeeMerge(200)

    expect(state.expenses[0].payeeId).toBe(3)
    expect(state.expenses[0].payeeNameSnapshot).toBe('Cafe')
  })

  it('updates split container payee defaults on merge and restores them on revert', async () => {
    state.payees.set(3, { id: 3, name: 'Cafe', deletedAt: null, isArchived: false })
    state.payees.set(4, { id: 4, name: 'Coffee House', deletedAt: null, isArchived: false })
    state.expenseSplits.push({
      id: 71,
      date: '2026-05-01',
      amount: 25,
      payeeId: 3,
      payeeNameSnapshot: 'Cafe',
      deletedAt: null,
    })

    const mergeId = await mergePayee(3, 4)
    expect(state.expenseSplits[0].payeeId).toBe(4)
    expect(state.expenseSplits[0].payeeNameSnapshot).toBe('Coffee House')

    const mergeHistory = state.payeeMergeHistory.get(mergeId)
    expect(mergeHistory?.affectedSplitIds).toEqual([71])

    await revertPayeeMerge(mergeId)

    expect(state.expenseSplits[0].payeeId).toBe(3)
    expect(state.expenseSplits[0].payeeNameSnapshot).toBe('Cafe')
  })
})
