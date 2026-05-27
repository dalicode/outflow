import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

function createSplitTable(initial: Row[] = []) {
  let rows = [...initial]
  let nextId = 1

  return {
    reset: () => {
      rows = []
      nextId = 1
    },
    rows: () => rows,
    setRows: (nextRows: Row[]) => {
      rows = nextRows.map((row) => ({ ...row }))
      nextId =
        nextRows.reduce(
          (maxId, row) => (typeof row.id === 'number' ? Math.max(maxId, row.id) : maxId),
          0,
        ) + 1
    },
    toArray: async () => rows.map((row) => ({ ...row })),
    orderBy: (_key: string) => ({
      toArray: async () => [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    }),
    add: async (row: Row) => {
      const id = nextId++
      rows.push({ ...row, id })
      return id
    },
    get: async (id: number) => rows.find((row) => row.id === id),
    put: async (row: Row) => {
      if (typeof row.id !== 'number') {
        const id = nextId++
        rows.push({ ...row, id })
        return id
      }
      const index = rows.findIndex((entry) => entry.id === row.id)
      if (index >= 0) {
        rows[index] = { ...row }
      } else {
        rows.push({ ...row })
      }
      return row.id
    },
  }
}

function createExpenseTable(initial: Row[] = []) {
  let rows = [...initial]
  let nextId = 1

  return {
    reset: () => {
      rows = []
      nextId = 1
    },
    seed: (nextRows: Row[]) => {
      rows = nextRows.map((row) => ({ ...row }))
      nextId =
        nextRows.reduce(
          (maxId, row) => (typeof row.id === 'number' ? Math.max(maxId, row.id) : maxId),
          0,
        ) + 1
    },
    rows: () => rows,
    setRows: (nextRows: Row[]) => {
      rows = nextRows.map((row) => ({ ...row }))
      nextId =
        nextRows.reduce(
          (maxId, row) => (typeof row.id === 'number' ? Math.max(maxId, row.id) : maxId),
          0,
        ) + 1
    },
    toArray: async () => rows.map((row) => ({ ...row })),
    where: (field: string) => ({
      equals: (value: unknown) => ({
        toArray: async () => rows.filter((row) => row[field] === value),
      }),
    }),
    get: async (id: number) => rows.find((row) => row.id === id),
    add: async (row: Row) => {
      const id = nextId++
      rows.push({ ...row, id })
      return id
    },
    put: async (row: Row) => {
      if (typeof row.id !== 'number') return
      const index = rows.findIndex((entry) => entry.id === row.id)
      if (index >= 0) {
        rows[index] = { ...row }
      } else {
        rows.push({ ...row })
      }
    },
  }
}

function createLookupTable(initial: Row[] = []) {
  let rows = [...initial]

  return {
    reset: () => {
      rows = []
    },
    seed: (nextRows: Row[]) => {
      rows = nextRows.map((row) => ({ ...row }))
    },
    get: async (id: number) => rows.find((row) => row.id === id),
  }
}

const { splitTable, expenseTable, categoriesTable, payeesTable, transaction } = vi.hoisted(() => ({
  splitTable: createSplitTable(),
  expenseTable: createExpenseTable(),
  categoriesTable: createLookupTable(),
  payeesTable: createLookupTable(),
  transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
    const scope = args[args.length - 1] as () => Promise<void>
    const splitSnapshot = splitTable.rows().map((row) => ({ ...row }))
    const expenseSnapshot = expenseTable.rows().map((row) => ({ ...row }))
    try {
      await scope()
    } catch (error) {
      splitTable.setRows(splitSnapshot)
      expenseTable.setRows(expenseSnapshot)
      throw error
    }
  }),
}))

vi.mock('../services/db/schema', () => ({
  default: {
    expenseSplits: splitTable,
    expenses: expenseTable,
    categories: categoriesTable,
    payees: payeesTable,
    transaction,
  },
}))

import {
  addExpenseSplit,
  getAllSplitChildExpenses,
  getExpenseSplits,
  repairOrphanedSplitChildren,
  removeExpenseSplit,
  restoreExpenseSplit,
  saveExpenseSplitWithChildren,
  unsplitSplitChildExpense,
  updateExpenseSplit,
  unsplitExpenseSplit,
} from '../services/repositories/expenseSplitRepository'

describe('expenseSplitRepository', () => {
  beforeEach(() => {
    splitTable.reset()
    expenseTable.reset()
    categoriesTable.reset()
    payeesTable.reset()
    vi.clearAllMocks()
  })

  it('separates active split reads from tombstoned rows', async () => {
    const splitId = await addExpenseSplit({
      date: '2026-05-01',
      amount: 100,
      notes: 'Groceries run',
    })

    await removeExpenseSplit(splitId)

    const active = await getExpenseSplits()
    const allChildren = await getAllSplitChildExpenses(splitId)

    expect(active).toHaveLength(0)
    expect(allChildren).toHaveLength(0)
  })

  it('tombstones and restores container with linked child expenses', async () => {
    const splitId = await addExpenseSplit({
      date: '2026-05-04',
      amount: 78,
      payeeId: 14,
    })

    expenseTable.seed([
      { id: 1, date: '2026-05-04', amount: 38, splitId, deletedAt: null },
      { id: 2, date: '2026-05-04', amount: 40, splitId, deletedAt: null },
      { id: 3, date: '2026-05-04', amount: 15, deletedAt: null },
    ])

    await removeExpenseSplit(splitId)

    const deletedChildren = await getAllSplitChildExpenses(splitId)
    expect(deletedChildren).toHaveLength(2)
    expect(deletedChildren.every((row) => row.deletedAt != null)).toBe(true)

    await restoreExpenseSplit(splitId)

    const restoredChildren = await getAllSplitChildExpenses(splitId)
    expect(restoredChildren).toHaveLength(2)
    expect(restoredChildren.every((row) => row.deletedAt == null)).toBe(true)
  })

  it('propagates container date and payee updates to child expenses', async () => {
    const splitId = await addExpenseSplit({
      date: '2026-05-04',
      amount: 78,
      payeeId: 14,
      payeeNameSnapshot: 'Cafe',
    })

    expenseTable.seed([
      {
        id: 1,
        date: '2026-05-04',
        amount: 38,
        splitId,
        payeeId: 14,
        payeeNameSnapshot: 'Cafe',
        deletedAt: null,
      },
      {
        id: 2,
        date: '2026-05-04',
        amount: 40,
        splitId,
        payeeId: 14,
        payeeNameSnapshot: 'Cafe',
        deletedAt: null,
      },
    ])

    await updateExpenseSplit(splitId, {
      date: '2026-05-09',
      payeeId: 33,
      payeeNameSnapshot: 'Grocer',
      notes: 'Container only',
    })

    const children = await getAllSplitChildExpenses(splitId)
    expect(children.map((row) => row.date)).toEqual(['2026-05-09', '2026-05-09'])
    expect(children.map((row) => row.payeeId)).toEqual([33, 33])
    expect(children.map((row) => row.payeeNameSnapshot)).toEqual(['Grocer', 'Grocer'])
    expect(children.every((row) => row.syncStatus === 'pending')).toBe(true)
  })

  it('re-normalizes restored child date and payee from the container', async () => {
    const splitId = await addExpenseSplit({
      date: '2026-05-04',
      amount: 78,
      payeeId: 14,
      payeeNameSnapshot: 'Cafe',
    })

    expenseTable.seed([
      {
        id: 1,
        date: '2026-05-01',
        amount: 38,
        splitId,
        payeeId: 99,
        payeeNameSnapshot: 'Wrong',
        deletedAt: '2026-05-05T00:00:00.000Z',
      },
    ])

    await restoreExpenseSplit(splitId)

    const [child] = await getAllSplitChildExpenses(splitId)
    expect(child.date).toBe('2026-05-04')
    expect(child.payeeId).toBe(14)
    expect(child.payeeNameSnapshot).toBe('Cafe')
    expect(child.deletedAt).toBeNull()
  })

  it('unsplits by removing child splitId while tombstoning the container', async () => {
    const splitId = await addExpenseSplit({
      date: '2026-05-10',
      amount: 120,
      notes: 'Split dinner',
    })

    expenseTable.seed([
      { id: 1, date: '2026-05-10', amount: 70, splitId, categoryId: 8, deletedAt: null },
      { id: 2, date: '2026-05-10', amount: 50, splitId, categoryId: 9, deletedAt: null },
    ])

    await unsplitExpenseSplit(splitId)

    const children = await getAllSplitChildExpenses(splitId)
    expect(children).toHaveLength(0)

    const allRows = expenseTable.rows()
    expect(allRows.map((row) => row.splitId)).toEqual([undefined, undefined])
    expect(allRows.every((row) => row.deletedAt == null)).toBe(true)
    expect(allRows.every((row) => row.syncStatus === 'pending')).toBe(true)
  })

  it('unsplits one child allocation and keeps the remaining split balanced', async () => {
    const splitId = await addExpenseSplit({
      date: '2026-05-10',
      amount: 120,
      notes: 'Split dinner',
    })

    expenseTable.seed([
      { id: 1, date: '2026-05-10', amount: 70, splitId, categoryId: 8, deletedAt: null },
      { id: 2, date: '2026-05-10', amount: 50, splitId, categoryId: 9, deletedAt: null },
    ])

    await unsplitSplitChildExpense(1)

    const allRows = expenseTable.rows()
    expect(allRows.find((row) => row.id === 1)).toEqual(
      expect.objectContaining({
        id: 1,
        splitId: undefined,
        amount: 70,
        deletedAt: null,
        syncStatus: 'pending',
      }),
    )
    expect(allRows.find((row) => row.id === 2)).toEqual(
      expect.objectContaining({
        id: 2,
        splitId,
        amount: 50,
        deletedAt: null,
      }),
    )
    expect(splitTable.rows()[0]).toEqual(
      expect.objectContaining({
        id: splitId,
        amount: 50,
        deletedAt: null,
        syncStatus: 'pending',
      }),
    )
  })

  it('tombstones the split container when unsplitting its last child allocation', async () => {
    const splitId = await addExpenseSplit({
      date: '2026-05-10',
      amount: 40,
      notes: 'Single split line',
    })

    expenseTable.seed([
      { id: 1, date: '2026-05-10', amount: 40, splitId, categoryId: 8, deletedAt: null },
    ])

    await unsplitSplitChildExpense(1)

    expect(expenseTable.rows()[0]).toEqual(
      expect.objectContaining({
        id: 1,
        splitId: undefined,
        deletedAt: null,
        syncStatus: 'pending',
      }),
    )
    expect(splitTable.rows()[0]).toEqual(
      expect.objectContaining({
        id: splitId,
        deletedAt: expect.any(String),
      }),
    )
  })

  it('detaches orphaned child expenses for missing or tombstoned containers', async () => {
    const activeSplitId = await addExpenseSplit({
      date: '2026-05-10',
      amount: 120,
      notes: 'Valid split',
    })
    const tombstonedSplitId = await addExpenseSplit({
      date: '2026-05-11',
      amount: 90,
      notes: 'Deleted split',
    })
    await removeExpenseSplit(tombstonedSplitId)

    expenseTable.seed([
      {
        id: 1,
        date: '2026-05-10',
        amount: 70,
        splitId: 999,
        categoryId: 8,
        notes: 'Missing parent',
        deletedAt: null,
      },
      {
        id: 2,
        date: '2026-05-11',
        amount: 50,
        splitId: tombstonedSplitId,
        categoryId: 9,
        notes: 'Deleted parent',
        deletedAt: null,
      },
      {
        id: 3,
        date: '2026-05-12',
        amount: 30,
        splitId: activeSplitId,
        categoryId: 10,
        notes: 'Valid child',
        deletedAt: null,
      },
    ])

    const repairedCount = await repairOrphanedSplitChildren()

    expect(repairedCount).toBe(2)
    const rows = expenseTable.rows()
    expect(rows[0].splitId).toBeUndefined()
    expect(rows[1].splitId).toBeUndefined()
    expect(rows[2].splitId).toBe(activeSplitId)
    expect(rows[0].notes).toBe('Missing parent')
    expect(rows[1].notes).toBe('Deleted parent')
    expect(rows[0].syncStatus).toBe('pending')
    expect(rows[1].syncStatus).toBe('pending')
  })

  it('saves split edits atomically, including child removal and new child insertion', async () => {
    categoriesTable.seed([
      { id: 1, name: 'Food', deletedAt: null },
      { id: 2, name: 'Travel', deletedAt: null },
      { id: 3, name: 'Coffee', deletedAt: null },
    ])
    payeesTable.seed([{ id: 9, name: 'Cafe Nova', deletedAt: null }])

    const splitId = await addExpenseSplit({
      date: '2026-05-10',
      amount: 12,
      payeeId: 9,
      payeeNameSnapshot: 'Cafe Nova',
      notes: 'Original split',
    })

    expenseTable.seed([
      { id: 1, date: '2026-05-10', amount: 5, splitId, categoryId: 1, deletedAt: null },
      { id: 2, date: '2026-05-10', amount: 7, splitId, categoryId: 2, deletedAt: null },
    ])

    await saveExpenseSplitWithChildren({
      splitId,
      split: {
        date: '2026-05-11',
        amount: 15,
        payeeId: 9,
        payeeNameSnapshot: 'Cafe Nova',
        notes: 'Updated split',
      },
      children: [
        { expenseId: 1, categoryId: 1, payeeId: 9, notes: 'Updated child', amount: 6 },
        { categoryId: 3, payeeId: 9, notes: 'New child', amount: 9 },
      ],
    })

    const rows = expenseTable.rows()
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual(
      expect.objectContaining({ id: 1, date: '2026-05-11', amount: 6, splitId }),
    )
    expect(rows[1]).toEqual(expect.objectContaining({ id: 2, deletedAt: expect.any(String) }))
    expect(rows[2]).toEqual(
      expect.objectContaining({
        date: '2026-05-11',
        amount: 9,
        splitId,
        categoryId: 3,
        payeeId: 9,
        categoryNameSnapshot: 'Coffee',
        payeeNameSnapshot: 'Cafe Nova',
      }),
    )
    expect(transaction).toHaveBeenCalledWith(
      'rw',
      splitTable,
      expenseTable,
      categoriesTable,
      payeesTable,
      expect.any(Function),
    )
  })

  it('rolls back the split save when a child write fails', async () => {
    categoriesTable.seed([{ id: 1, name: 'Food', deletedAt: null }])

    const splitId = await addExpenseSplit({
      date: '2026-05-10',
      amount: 12,
      notes: 'Original split',
    })

    expenseTable.seed([
      { id: 1, date: '2026-05-10', amount: 12, splitId, categoryId: 1, deletedAt: null },
    ])

    const originalAdd = expenseTable.add
    const addSpy = vi.spyOn(expenseTable, 'add').mockImplementationOnce(async (_row: Row) => {
      throw new Error('insert failed')
    })

    await expect(
      saveExpenseSplitWithChildren({
        splitId,
        split: {
          date: '2026-05-11',
          amount: 12,
          notes: 'Updated split',
        },
        children: [
          { expenseId: 1, categoryId: 1, amount: 6 },
          { categoryId: 1, amount: 6 },
        ],
      }),
    ).rejects.toThrow('insert failed')

    expect(splitTable.rows()[0]).toEqual(
      expect.objectContaining({ id: splitId, date: '2026-05-10' }),
    )
    expect(expenseTable.rows()).toEqual([
      expect.objectContaining({ id: 1, date: '2026-05-10', amount: 12, splitId, deletedAt: null }),
    ])

    addSpy.mockImplementation(originalAdd)
  })
})
