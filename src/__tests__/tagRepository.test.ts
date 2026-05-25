import { beforeEach, describe, expect, it, vi } from 'vitest'

type TagRow = Record<string, unknown> & {
  id?: number
  name: string
  normalizedName?: string
  isArchived?: boolean
  deletedAt?: string | null
}

type ExpenseTagRow = Record<string, unknown> & {
  id?: number
  expenseId: number
  tagId: number
  deletedAt?: string | null
}

function createTable<T extends { id?: number }>(initialRows: T[] = []) {
  let rows = [...initialRows]
  let nextId =
    rows.reduce((max, row) => (typeof row.id === 'number' ? Math.max(max, row.id) : max), 0) + 1

  return {
    reset: (nextRows: T[] = []) => {
      rows = [...nextRows]
      nextId =
        rows.reduce(
          (max, row) => (typeof row.id === 'number' ? Math.max(max, row.id) : max),
          0,
        ) + 1
    },
    toArray: async () => rows.map((row) => ({ ...row })),
    where: (field: string) => ({
      equals: (value: unknown) => ({
        toArray: async () => rows.filter((row) => (row as Record<string, unknown>)[field] === value),
      }),
    }),
    bulkGet: async (ids: number[]) =>
      ids.map((id) => rows.find((row) => row.id === id)).map((row) => (row ? { ...row } : row)),
    get: async (id: number) => {
      const row = rows.find((entry) => entry.id === id)
      return row ? { ...row } : undefined
    },
    add: async (row: T) => {
      const id = nextId++
      rows.push({ ...row, id })
      return id
    },
    put: async (row: T) => {
      if (typeof row.id === 'number') {
        const index = rows.findIndex((entry) => entry.id === row.id)
        if (index >= 0) {
          rows[index] = { ...row }
          return row.id
        }
      }
      const id = nextId++
      rows.push({ ...row, id })
      return id
    },
  }
}

const mocks = vi.hoisted(() => {
  const tags = createTable<TagRow>()
  const expenseTags = createTable<ExpenseTagRow>()
  const transaction = vi.fn(async (_mode: string, ...args: unknown[]) => {
    const scope = args[args.length - 1] as () => Promise<void>
    await scope()
  })

  return { tags, expenseTags, transaction }
})

vi.mock('../services/db/schema', () => ({
  default: {
    tags: mocks.tags,
    expenseTags: mocks.expenseTags,
    transaction: mocks.transaction,
  },
}))

import {
  addTag,
  getExpenseTagsMap,
  getTagIdsForExpense,
  setExpenseTags,
} from '../services/repositories/tagRepository'

describe('tagRepository', () => {
  beforeEach(() => {
    mocks.tags.reset()
    mocks.expenseTags.reset()
    vi.clearAllMocks()
  })

  it('creates normalized tags and rejects duplicate active names', async () => {
    const id = await addTag('  Work Trip  ')
    const rows = await mocks.tags.toArray()

    expect(id).toBeGreaterThan(0)
    expect(rows[0]).toEqual(
      expect.objectContaining({
        name: 'Work Trip',
        normalizedName: 'work trip',
        isArchived: false,
        deletedAt: null,
      }),
    )

    await expect(addTag('work trip')).rejects.toThrow('already exists')
  })

  it('revives archived and tombstoned tags when re-added', async () => {
    mocks.tags.reset([
      { id: 4, name: 'Legacy', normalizedName: 'legacy', isArchived: true, deletedAt: null },
      {
        id: 7,
        name: 'Dormant',
        normalizedName: 'dormant',
        isArchived: false,
        deletedAt: '2026-05-01T00:00:00.000Z',
      },
    ])

    const archivedId = await addTag('legacy')
    const revivedArchived = await mocks.tags.get(4)
    expect(archivedId).toBe(4)
    expect(revivedArchived).toEqual(
      expect.objectContaining({ isArchived: false, deletedAt: null, name: 'legacy' }),
    )

    const tombstonedId = await addTag('Dormant')
    const revivedTombstone = await mocks.tags.get(7)
    expect(tombstonedId).toBe(7)
    expect(revivedTombstone).toEqual(
      expect.objectContaining({ isArchived: false, deletedAt: null, name: 'Dormant' }),
    )
  })

  it('replaces joins, tombstones removed rows, and revives existing joins', async () => {
    mocks.expenseTags.reset([
      { id: 1, expenseId: 10, tagId: 100, deletedAt: null, localId: 'join-1' },
      { id: 2, expenseId: 10, tagId: 101, deletedAt: '2026-05-01T00:00:00.000Z', localId: 'join-2' },
      { id: 3, expenseId: 10, tagId: 102, deletedAt: null, localId: 'join-3' },
    ])

    await setExpenseTags(10, [101, 103])

    const rows = await mocks.expenseTags.toArray()
    const activeRows = rows.filter((row) => row.deletedAt == null)

    expect(activeRows.map((row) => row.tagId).sort((a, b) => a - b)).toEqual([101, 103])
    expect(rows.find((row) => row.id === 1)?.deletedAt).toEqual(expect.any(String))
    expect(rows.find((row) => row.id === 2)?.deletedAt).toBeNull()
    expect(rows.find((row) => row.tagId === 103)).toEqual(
      expect.objectContaining({ expenseId: 10, tagId: 103, deletedAt: null }),
    )
    expect(await getTagIdsForExpense(10)).toEqual([101, 103])
  })

  it('returns active tag rows grouped by expense id', async () => {
    mocks.tags.reset([
      { id: 11, name: 'Work', normalizedName: 'work', deletedAt: null },
      { id: 12, name: 'Archived', normalizedName: 'archived', isArchived: true, deletedAt: null },
      { id: 13, name: 'Removed', normalizedName: 'removed', deletedAt: '2026-05-01T00:00:00.000Z' },
    ])
    mocks.expenseTags.reset([
      { id: 1, expenseId: 20, tagId: 11, deletedAt: null },
      { id: 2, expenseId: 20, tagId: 12, deletedAt: null },
      { id: 3, expenseId: 21, tagId: 13, deletedAt: null },
      { id: 4, expenseId: 21, tagId: 11, deletedAt: '2026-05-02T00:00:00.000Z' },
    ])

    await expect(getExpenseTagsMap([20, 21, 22])).resolves.toEqual({
      20: [
        expect.objectContaining({ id: 11, name: 'Work' }),
        expect.objectContaining({ id: 12, name: 'Archived', isArchived: true }),
      ],
      21: [],
      22: [],
    })
  })
})
