import { beforeEach, describe, expect, it, vi } from 'vitest'

type SnapshotRow = Record<string, unknown> & { id?: number }

function createTable(initial: SnapshotRow[] = []) {
  let rows = [...initial]
  let nextId = 1
  const all = () => rows
  const match = (field: string, value: unknown) =>
    rows.filter((row) => JSON.stringify(row[field]) === JSON.stringify(value))

  return {
    data: all,
    reset: () => {
      rows = []
      nextId = 1
    },
    where: (field: string) => ({
      equals: (value: unknown) => ({
        toArray: async () => match(field, value),
        first: async () => match(field, value)[0],
      }),
    }),
    add: async (row: SnapshotRow) => {
      const id = nextId++
      rows.push({ ...row, id })
      return id
    },
    put: async (row: SnapshotRow) => {
      if (row.id == null) {
        const id = nextId++
        rows.push({ ...row, id })
        return id
      }
      rows = rows.map((r) => (r.id === row.id ? { ...row } : r))
      return row.id
    },
    get: async (id: number) => rows.find((row) => row.id === id),
    delete: async (id: number) => {
      rows = rows.filter((row) => row.id !== id)
    },
  }
}

const {
  enqueueMock,
  transactionMock,
  fixedExpenses,
  fixedExpenseSnapshots,
  incomeSnapshots,
  savingsSnapshots,
  syncQueue,
} =
  vi.hoisted(() => ({
    enqueueMock: vi.fn(async () => 1),
    transactionMock: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const scope = args[args.length - 1] as () => Promise<void>
      await scope()
    }),
    fixedExpenses: createTable(),
    fixedExpenseSnapshots: createTable(),
    incomeSnapshots: createTable(),
    savingsSnapshots: createTable(),
    syncQueue: {},
  }))

vi.mock('../services/db/schema', () => ({
  default: {
    fixedExpenses,
    fixedExpenseSnapshots,
    incomeSnapshots,
    savingsSnapshots,
    syncQueue,
    transaction: transactionMock,
  },
}))

vi.mock('../services/repositories/common', () => ({
  enqueue: enqueueMock,
}))

import { saveHistoricalSnapshotConfigs } from '../services/repositories/historicalSnapshotRepository'

describe('saveHistoricalSnapshotConfigs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fixedExpenses.reset()
    fixedExpenseSnapshots.reset()
    incomeSnapshots.reset()
    savingsSnapshots.reset()
  })

  it('runs all historical snapshot writes in one transaction', async () => {
    await saveHistoricalSnapshotConfigs({
      dirtyYears: new Set([2025]),
      yearConfigs: {
        2025: {
          incomeRanges: [],
          savingsRanges: [],
          fixedItems: [],
        },
      },
    })

    expect(transactionMock).toHaveBeenCalledTimes(1)
    const [_mode, ...tablesAndScope] = transactionMock.mock.calls[0] as [string, ...unknown[]]
    expect(tablesAndScope).toEqual(
      expect.arrayContaining([
        fixedExpenses,
        fixedExpenseSnapshots,
        incomeSnapshots,
        savingsSnapshots,
        syncQueue,
      ]),
    )
  })

  it('skips unchanged rows, updates changed rows, and deletes removed rows', async () => {
    await incomeSnapshots.add({ year: 2025, month: 1, amountSnapshot: 5000, cloudId: 'i1' })
    await incomeSnapshots.add({ year: 2025, month: 2, amountSnapshot: 5000, cloudId: 'i2' })
    await savingsSnapshots.add({ year: 2025, month: 1, rateSnapshot: 10, cloudId: 's1' })
    await fixedExpenseSnapshots.add({
      fixedExpenseId: 7,
      year: 2025,
      month: 1,
      amountSnapshot: 1200,
      nameSnapshot: 'Rent',
      cloudId: 'f1',
    })
    await fixedExpenseSnapshots.add({
      fixedExpenseId: 8,
      year: 2025,
      month: 1,
      amountSnapshot: 200,
      nameSnapshot: 'Insurance',
      cloudId: 'f2',
    })

    await saveHistoricalSnapshotConfigs({
      dirtyYears: new Set([2025]),
      yearConfigs: {
        2025: {
          incomeRanges: [{ id: 'inc', amount: '6000', startMonth: 1, endMonth: 1 }],
          savingsRanges: [{ id: 'sav', amount: '10', startMonth: 1, endMonth: 1 }],
          fixedItems: [
            {
              id: 'fx1',
              name: 'Rent',
              amount: '1200',
              startMonth: 1,
              endMonth: 1,
              existingFixedExpenseId: 7,
            },
          ],
        },
      },
    })

    expect(incomeSnapshots.data()).toHaveLength(1)
    expect((incomeSnapshots.data()[0].amountSnapshot as number) === 6000).toBe(true)
    expect(savingsSnapshots.data()).toHaveLength(1)
    expect(fixedExpenseSnapshots.data()).toHaveLength(1)
    expect(fixedExpenseSnapshots.data()[0].fixedExpenseId).toBe(7)
    expect(enqueueMock).toHaveBeenCalledWith('fixedExpenseSnapshots', 'delete', {
      id: 2,
      cloudId: 'f2',
    })
  })

  it('handles changed fixed names/amounts and month gaps for same fixedExpenseId', async () => {
    await fixedExpenseSnapshots.add({
      fixedExpenseId: 11,
      year: 2025,
      month: 1,
      amountSnapshot: 1000,
      nameSnapshot: 'Old',
      cloudId: 'a',
    })
    await fixedExpenseSnapshots.add({
      fixedExpenseId: 11,
      year: 2025,
      month: 2,
      amountSnapshot: 1000,
      nameSnapshot: 'Old',
      cloudId: 'b',
    })

    await saveHistoricalSnapshotConfigs({
      dirtyYears: new Set([2025]),
      yearConfigs: {
        2025: {
          incomeRanges: [],
          savingsRanges: [],
          fixedItems: [
            {
              id: 'one',
              name: 'New',
              amount: '1200',
              startMonth: 1,
              endMonth: 1,
              existingFixedExpenseId: 11,
            },
            {
              id: 'two',
              name: 'New',
              amount: '1200',
              startMonth: 3,
              endMonth: 3,
              existingFixedExpenseId: 11,
            },
          ],
        },
      },
    })

    const keys = fixedExpenseSnapshots.data().map((row) => `${row.fixedExpenseId}-${row.month}`)
    expect(keys).toEqual(expect.arrayContaining(['11-1', '11-3']))
    expect(keys).not.toContain('11-2')
    expect(fixedExpenseSnapshots.data().find((row) => row.month === 1)?.nameSnapshot).toBe('New')
  })

  it('enqueues sync operations for snapshot insert/update/delete and archived fixed inserts', async () => {
    await incomeSnapshots.add({ year: 2025, month: 1, amountSnapshot: 4000, cloudId: 'i1' })
    await incomeSnapshots.add({ year: 2025, month: 2, amountSnapshot: 4000, cloudId: 'i2' })
    await savingsSnapshots.add({ year: 2025, month: 2, rateSnapshot: 10, cloudId: 's2' })
    await fixedExpenseSnapshots.add({
      fixedExpenseId: 7,
      year: 2025,
      month: 2,
      amountSnapshot: 1000,
      nameSnapshot: 'Rent',
      cloudId: 'f2',
    })
    await fixedExpenseSnapshots.add({
      fixedExpenseId: 7,
      year: 2025,
      month: 3,
      amountSnapshot: 1000,
      nameSnapshot: 'Rent',
      cloudId: 'f3',
    })

    await saveHistoricalSnapshotConfigs({
      dirtyYears: new Set([2025]),
      yearConfigs: {
        2025: {
          incomeRanges: [
            { id: 'i-update', amount: '5000', startMonth: 1, endMonth: 1 },
            { id: 'i-insert', amount: '5500', startMonth: 3, endMonth: 3 },
          ],
          savingsRanges: [{ id: 's-insert', amount: '20', startMonth: 1, endMonth: 1 }],
          fixedItems: [
            {
              id: 'f-update',
              name: 'Rent Updated',
              amount: '1200',
              startMonth: 2,
              endMonth: 2,
              existingFixedExpenseId: 7,
            },
            { id: 'f-new', name: 'Insurance', amount: '200', startMonth: 1, endMonth: 1 },
          ],
        },
      },
    })

    expect(enqueueMock).toHaveBeenCalledWith('incomeSnapshots', 'update', expect.any(Object))
    expect(enqueueMock).toHaveBeenCalledWith('incomeSnapshots', 'insert', expect.any(Object))
    expect(enqueueMock).toHaveBeenCalledWith('incomeSnapshots', 'delete', expect.any(Object))
    expect(enqueueMock).toHaveBeenCalledWith('savingsSnapshots', 'insert', expect.any(Object))
    expect(enqueueMock).toHaveBeenCalledWith('savingsSnapshots', 'delete', expect.any(Object))
    expect(enqueueMock).toHaveBeenCalledWith('fixedExpenseSnapshots', 'update', expect.any(Object))
    expect(enqueueMock).toHaveBeenCalledWith('fixedExpenseSnapshots', 'insert', expect.any(Object))
    expect(enqueueMock).toHaveBeenCalledWith('fixedExpenseSnapshots', 'delete', expect.any(Object))
    expect(enqueueMock).toHaveBeenCalledWith('fixedExpenses', 'insert', expect.any(Object))
  })
})
