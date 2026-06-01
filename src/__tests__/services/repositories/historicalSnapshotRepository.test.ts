import { beforeEach, describe, expect, it, vi } from 'vitest'

type SnapshotRow = Record<string, unknown> & { id?: number }

function createTable(initial: SnapshotRow[] = []) {
  let rows = [...initial]
  let nextId = 1
  const match = (field: string, value: unknown) =>
    rows.filter((row) => JSON.stringify(row[field]) === JSON.stringify(value))

  return {
    data: () => rows,
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
      rows = rows.map((entry) => (entry.id === row.id ? { ...row } : entry))
      return row.id
    },
    bulkPut: async (nextRows: SnapshotRow[]) => {
      for (const row of nextRows) {
        if (row.id == null) {
          const id = nextId++
          rows.push({ ...row, id })
        } else {
          rows = rows.map((entry) => (entry.id === row.id ? { ...row } : entry))
        }
      }
    },
    get: async (id: number) => rows.find((row) => row.id === id),
  }
}

const { transactionMock, fixedExpenses, fixedExpenseSnapshots, incomeSnapshots, savingsSnapshots } =
  vi.hoisted(() => ({
    transactionMock: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const scope = args[args.length - 1] as () => Promise<void>
      await scope()
    }),
    fixedExpenses: createTable(),
    fixedExpenseSnapshots: createTable(),
    incomeSnapshots: createTable(),
    savingsSnapshots: createTable(),
  }))

vi.mock('@/services/db/schema', () => ({
  default: {
    fixedExpenses,
    fixedExpenseSnapshots,
    incomeSnapshots,
    savingsSnapshots,
    transaction: transactionMock,
  },
}))

import { saveHistoricalSnapshotConfigs } from '@/services/repositories/historicalSnapshotRepository'

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
      ]),
    )
  })

  it('tombstones removed rows instead of hard deleting during replace behavior', async () => {
    await incomeSnapshots.add({
      year: 2025,
      month: 1,
      amountSnapshot: 5000,
      localId: 'income-1',
      syncStatus: 'synced',
      deletedAt: null,
    })
    await savingsSnapshots.add({
      year: 2025,
      month: 1,
      rateSnapshot: 10,
      localId: 'savings-1',
      syncStatus: 'synced',
      deletedAt: null,
    })
    await fixedExpenseSnapshots.add({
      fixedExpenseId: 7,
      year: 2025,
      month: 1,
      amountSnapshot: 1200,
      nameSnapshot: 'Rent',
      localId: 'fixed-1',
      syncStatus: 'synced',
      deletedAt: null,
    })

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

    expect(incomeSnapshots.data()).toHaveLength(1)
    expect(incomeSnapshots.data()[0].deletedAt).toEqual(expect.any(String))
    expect(savingsSnapshots.data()[0].deletedAt).toEqual(expect.any(String))
    expect(fixedExpenseSnapshots.data()[0].deletedAt).toEqual(expect.any(String))
  })

  it('restores tombstoned snapshots when the same month is reintroduced', async () => {
    await incomeSnapshots.add({
      year: 2025,
      month: 1,
      amountSnapshot: 5000,
      localId: 'income-1',
      syncStatus: 'synced',
      deletedAt: '2026-05-01T00:00:00.000Z',
    })

    await saveHistoricalSnapshotConfigs({
      dirtyYears: new Set([2025]),
      yearConfigs: {
        2025: {
          incomeRanges: [{ id: 'inc', amount: '6000', startMonth: 1, endMonth: 1 }],
          savingsRanges: [],
          fixedItems: [],
        },
      },
    })

    const restored = incomeSnapshots.data()[0]
    expect(restored.deletedAt).toBeNull()
    expect(restored.amountSnapshot).toBe(6000)
    expect(restored.syncStatus).toBe('pending')
  })

  it('repairs contiguous fixed snapshot identity splits before saving historical changes', async () => {
    await fixedExpenseSnapshots.add({
      fixedExpenseId: 100,
      year: 2026,
      month: 4,
      amountSnapshot: 1200,
      nameSnapshot: 'Mortgage',
      localId: 'mortgage-apr',
      syncStatus: 'synced',
      deletedAt: null,
    })
    await fixedExpenseSnapshots.add({
      fixedExpenseId: 11,
      year: 2026,
      month: 5,
      amountSnapshot: 1200.0000000001,
      nameSnapshot: 'Mortgage',
      localId: 'mortgage-may',
      syncStatus: 'synced',
      deletedAt: null,
    })

    await saveHistoricalSnapshotConfigs({
      dirtyYears: new Set([2026]),
      yearConfigs: {
        2026: {
          incomeRanges: [],
          savingsRanges: [],
          fixedItems: [
            {
              id: 'mortgage',
              name: 'Mortgage',
              amount: '1200.00',
              startMonth: 4,
              endMonth: 5,
              existingFixedExpenseId: 100,
            },
          ],
        },
      },
    })

    const activeMortgageRows = fixedExpenseSnapshots
      .data()
      .filter((row) => row.nameSnapshot === 'Mortgage' && row.deletedAt == null)

    expect(activeMortgageRows).toHaveLength(2)
    expect(activeMortgageRows.every((row) => row.fixedExpenseId === 100)).toBe(true)
    expect(activeMortgageRows.find((row) => row.month === 5)?.syncStatus).toBe('pending')
  })
})
