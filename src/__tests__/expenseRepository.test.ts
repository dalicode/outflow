import { beforeEach, describe, expect, it, vi } from 'vitest'

type ExpenseRow = Record<string, unknown> & {
  id?: number
  date: string
  deletedAt?: string | null
}

function createExpenseTable(initial: ExpenseRow[] = []) {
  let rows = [...initial]
  let nextId = 1

  return {
    reset: () => {
      rows = []
      nextId = 1
    },
    rows: () => rows,
    orderBy: (_key: string) => ({
      toArray: async () => [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    }),
    add: async (row: ExpenseRow) => {
      const id = nextId++
      rows.push({ ...row, id })
      return id
    },
    put: async (row: ExpenseRow) => {
      if (row.id == null) {
        const id = nextId++
        rows.push({ ...row, id })
        return id
      }
      const exists = rows.some((entry) => entry.id === row.id)
      if (exists) {
        rows = rows.map((entry) => (entry.id === row.id ? { ...row } : entry))
      } else {
        rows.push({ ...row })
      }
      return row.id
    },
    get: async (id: number) => rows.find((row) => row.id === id),
    update: async (id: number, changes: Record<string, unknown>) => {
      rows = rows.map((row) => (row.id === id ? { ...row, ...changes } : row))
      return 1
    },
    bulkGet: async (ids: number[]) => ids.map((id) => rows.find((row) => row.id === id)),
    where: (field: string) => ({
      equals: (value: unknown) => ({
        toArray: async () => rows.filter((row) => row[field] === value),
      }),
    }),
    clear: async () => {
      rows = []
    },
    bulkAdd: async (records: ExpenseRow[]) => {
      for (const record of records) {
        const id = nextId++
        rows.push({ ...record, id })
      }
    },
  }
}

const {
  table,
  transaction,
  queueImportSyncMarker,
  categories,
  payees,
  setCategory,
  setPayee,
  clearLinkedRows,
} = vi.hoisted(() => {
    const categoryRows = new Map<number, { id: number; name: string; deletedAt?: string | null }>()
    const payeeRows = new Map<number, { id: number; name: string; deletedAt?: string | null }>()

    return {
      table: createExpenseTable(),
      transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
        const scope = args[args.length - 1] as () => Promise<void>
        await scope()
      }),
      queueImportSyncMarker: vi.fn(async () => undefined),
      categories: {
        get: vi.fn(async (id: number) => categoryRows.get(id)),
      },
      payees: {
        get: vi.fn(async (id: number) => payeeRows.get(id)),
      },
      setCategory: (id: number, name: string) => {
        categoryRows.set(id, { id, name, deletedAt: null })
      },
      setPayee: (id: number, name: string) => {
        payeeRows.set(id, { id, name, deletedAt: null })
      },
      clearLinkedRows: () => {
        categoryRows.clear()
        payeeRows.clear()
      },
    }
  })

vi.mock('../services/db/schema', () => ({
  default: {
    expenses: table,
    transaction,
    categories,
    payees,
  },
}))

vi.mock('../services/importService', () => ({
  queueImportSyncMarker,
}))

vi.mock('../services/syncRuntime', () => ({
  CSV_IMPORT_QUEUE_REASON: 'csv-import',
  CSV_REPLACE_QUEUE_REASON: 'csv-replace',
}))

import {
  add,
  getAll,
  getAllExpenses,
  remove,
  removeMany,
  restore,
  restoreMany,
  update,
} from '../services/repositories/expenseRepository'

describe('expenseRepository', () => {
  beforeEach(() => {
    table.reset()
    clearLinkedRows()
    vi.clearAllMocks()
  })

  it('separates active reads from all-row reads with tombstones', async () => {
    const id = await add({
      date: '2026-05-01',
      amount: 20,
      description: 'Coffee',
    })
    await remove(id)

    const active = await getAll()
    const all = await getAllExpenses()

    expect(active).toHaveLength(0)
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(id)
    expect(all[0].deletedAt).toEqual(expect.any(String))
  })

  it('tombstones bulk deletes and keeps same row identity for restores', async () => {
    const firstId = await add({ date: '2026-05-01', amount: 20, description: 'Coffee' })
    const secondId = await add({ date: '2026-05-02', amount: 45, description: 'Groceries' })

    await removeMany([firstId, secondId])

    const allAfterDelete = await getAllExpenses()
    expect(allAfterDelete.every((row) => row.deletedAt != null)).toBe(true)

    await restoreMany([firstId, secondId])

    const active = await getAll()
    expect(active.map((row) => row.id)).toEqual([firstId, secondId])
    expect(active.every((row) => row.deletedAt == null)).toBe(true)
  })

  it('restores a single tombstoned expense on the same id', async () => {
    const id = await add({ date: '2026-05-03', amount: 12, description: 'Transit' })
    await remove(id)
    await restore(id)

    const active = await getAll()
    const row = active.find((expense) => expense.id === id)
    expect(row).toBeDefined()
    expect(row?.deletedAt).toBeNull()
    expect(row?.syncStatus).toBe('pending')
  })

  it('populates category and payee name snapshots when adding an expense with linked ids', async () => {
    setCategory(10, 'Dining')
    setPayee(20, 'Cafe')

    const id = await add({
      date: '2026-05-06',
      amount: 32,
      categoryId: 10,
      payeeId: 20,
      description: 'Dinner',
    })

    const all = await getAllExpenses()
    const row = all.find((expense) => expense.id === id)
    expect(row?.categoryNameSnapshot).toBe('Dining')
    expect(row?.payeeNameSnapshot).toBe('Cafe')
  })

  it('refreshes snapshot names from linked ids on update', async () => {
    setCategory(10, 'Food')
    setPayee(20, 'Coffee Shop')
    const id = await add({
      date: '2026-05-07',
      amount: 8,
      categoryId: 10,
      payeeId: 20,
      description: 'Morning coffee',
    })

    setCategory(11, 'Transit')
    setPayee(21, 'Metro')
    await update(id, { categoryId: 11, payeeId: 21 })

    const all = await getAllExpenses()
    const row = all.find((expense) => expense.id === id)
    expect(row?.categoryId).toBe(11)
    expect(row?.payeeId).toBe(21)
    expect(row?.categoryNameSnapshot).toBe('Transit')
    expect(row?.payeeNameSnapshot).toBe('Metro')
  })
})
