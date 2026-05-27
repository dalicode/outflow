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

type ExpenseRow = Record<string, unknown> & {
  id?: number
  deletedAt?: string | null
}

type TagMergeHistoryRow = Record<string, unknown> & {
  id?: number
  sourceTagId: number
  targetTagId: number
  affectedExpenseTagIds: number[]
  duplicateExpenseTagIds: number[]
  revertedAt?: string | null
}

function createTable<T extends { id?: number }>(initialRows: T[] = []) {
  let rows = [...initialRows]
  let nextId =
    rows.reduce((max, row) => (typeof row.id === 'number' ? Math.max(max, row.id) : max), 0) + 1
  const anyOfCalls: unknown[] = []
  const bulkGetCalls: number[][] = []

  return {
    anyOfCalls,
    bulkGetCalls,
    reset: (nextRows: T[] = []) => {
      rows = [...nextRows]
      nextId =
        rows.reduce((max, row) => (typeof row.id === 'number' ? Math.max(max, row.id) : max), 0) + 1
      anyOfCalls.length = 0
      bulkGetCalls.length = 0
    },
    toArray: async () => rows.map((row) => ({ ...row })),
    where: (field: string) => ({
      equals: (value: unknown) => ({
        toArray: async () =>
          rows.filter((row) => (row as Record<string, unknown>)[field] === value),
      }),
      anyOf: (values: unknown[]) => {
        anyOfCalls.push([...values])
        return {
          toArray: async () =>
            rows.filter((row) => values.includes((row as Record<string, unknown>)[field])),
        }
      },
    }),
    bulkGet: async (ids: number[]) => {
      bulkGetCalls.push([...ids])
      return ids
        .map((id) => rows.find((row) => row.id === id))
        .map((row) => (row ? { ...row } : row))
    },
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
  const expenses = createTable<ExpenseRow>()
  const tagMergeHistory = createTable<TagMergeHistoryRow>()
  const transaction = vi.fn(async (_mode: string, ...args: unknown[]) => {
    const scope = args[args.length - 1] as () => Promise<unknown>
    return scope()
  })

  return { tags, expenseTags, expenses, tagMergeHistory, transaction }
})

vi.mock('../services/db/schema', () => ({
  default: {
    tags: mocks.tags,
    expenseTags: mocks.expenseTags,
    expenses: mocks.expenses,
    tagMergeHistory: mocks.tagMergeHistory,
    transaction: mocks.transaction,
  },
}))

import {
  addTag,
  archiveTag,
  getExpenseCountsForTags,
  getExpenseTagsMap,
  getExpenseCountForTag,
  getTagIdsForExpense,
  mergeTag,
  revertTagMerge,
  setExpenseTags,
  undoUnlinkAllAndArchiveTag,
  unlinkAllAndArchiveTag,
  unarchiveTag,
} from '../services/repositories/tagRepository'

describe('tagRepository', () => {
  beforeEach(() => {
    mocks.tags.reset()
    mocks.expenseTags.reset()
    mocks.expenses.reset()
    mocks.tagMergeHistory.reset()
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
      {
        id: 2,
        expenseId: 10,
        tagId: 101,
        deletedAt: '2026-05-01T00:00:00.000Z',
        localId: 'join-2',
      },
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

  it('archives and unarchives tags', async () => {
    mocks.tags.reset([
      { id: 9, name: 'Work', normalizedName: 'work', isArchived: false, deletedAt: null },
    ])

    await archiveTag(9)
    expect(await mocks.tags.get(9)).toEqual(expect.objectContaining({ isArchived: true }))

    await unarchiveTag(9)
    expect(await mocks.tags.get(9)).toEqual(expect.objectContaining({ isArchived: false }))
  })

  it('unlinks all active joins and archives tag with undo payload', async () => {
    mocks.tags.reset([
      { id: 9, name: 'Work', normalizedName: 'work', isArchived: false, deletedAt: null },
    ])
    mocks.expenseTags.reset([
      { id: 1, expenseId: 101, tagId: 9, deletedAt: null },
      { id: 2, expenseId: 102, tagId: 9, deletedAt: null },
      { id: 3, expenseId: 103, tagId: 9, deletedAt: '2026-05-01T00:00:00.000Z' },
      { id: 4, expenseId: 104, tagId: 10, deletedAt: null },
    ])

    await expect(unlinkAllAndArchiveTag(9)).resolves.toEqual({
      tagId: 9,
      unlinkedExpenseTagIds: [1, 2],
    })
    expect(await mocks.tags.get(9)).toEqual(expect.objectContaining({ isArchived: true }))
    expect(await mocks.expenseTags.get(1)).toEqual(
      expect.objectContaining({ deletedAt: expect.any(String) }),
    )
    expect(await mocks.expenseTags.get(2)).toEqual(
      expect.objectContaining({ deletedAt: expect.any(String) }),
    )
    expect(await mocks.expenseTags.get(3)).toEqual(
      expect.objectContaining({ deletedAt: '2026-05-01T00:00:00.000Z' }),
    )
    expect(await mocks.expenseTags.get(4)).toEqual(expect.objectContaining({ deletedAt: null }))
  })

  it('undoes unlink-and-archive by reviving only affected joins and unarchiving tag', async () => {
    mocks.tags.reset([
      { id: 9, name: 'Work', normalizedName: 'work', isArchived: true, deletedAt: null },
    ])
    mocks.expenseTags.reset([
      { id: 1, expenseId: 101, tagId: 9, deletedAt: '2026-05-10T00:00:00.000Z' },
      { id: 2, expenseId: 102, tagId: 9, deletedAt: '2026-05-10T00:00:00.000Z' },
      { id: 3, expenseId: 103, tagId: 9, deletedAt: null },
      { id: 4, expenseId: 104, tagId: 10, deletedAt: '2026-05-10T00:00:00.000Z' },
    ])

    await undoUnlinkAllAndArchiveTag({
      tagId: 9,
      unlinkedExpenseTagIds: [1, 4],
    })

    expect(await mocks.tags.get(9)).toEqual(expect.objectContaining({ isArchived: false }))
    expect(await mocks.expenseTags.get(1)).toEqual(expect.objectContaining({ deletedAt: null }))
    expect(await mocks.expenseTags.get(2)).toEqual(
      expect.objectContaining({ deletedAt: '2026-05-10T00:00:00.000Z' }),
    )
    expect(await mocks.expenseTags.get(4)).toEqual(
      expect.objectContaining({ deletedAt: '2026-05-10T00:00:00.000Z' }),
    )
  })

  it('counts only active expenses for a tag', async () => {
    mocks.expenseTags.reset([
      { id: 1, expenseId: 101, tagId: 5, deletedAt: null },
      { id: 2, expenseId: 102, tagId: 5, deletedAt: null },
      { id: 3, expenseId: 102, tagId: 5, deletedAt: null },
      { id: 4, expenseId: 103, tagId: 5, deletedAt: '2026-05-01T00:00:00.000Z' },
    ])
    mocks.expenses.reset([
      { id: 101, deletedAt: null },
      { id: 102, deletedAt: '2026-05-02T00:00:00.000Z' },
      { id: 103, deletedAt: null },
    ])

    await expect(getExpenseCountForTag(5)).resolves.toBe(1)
  })

  it('counts active expenses for multiple tags in one pass', async () => {
    mocks.expenseTags.reset([
      { id: 1, expenseId: 101, tagId: 5, deletedAt: null },
      { id: 2, expenseId: 102, tagId: 5, deletedAt: null },
      { id: 3, expenseId: 101, tagId: 6, deletedAt: null },
      { id: 4, expenseId: 103, tagId: 6, deletedAt: null },
      { id: 5, expenseId: 103, tagId: 7, deletedAt: '2026-05-01T00:00:00.000Z' },
    ])
    mocks.expenses.reset([
      { id: 101, deletedAt: null },
      { id: 102, deletedAt: '2026-05-02T00:00:00.000Z' },
      { id: 103, deletedAt: null },
    ])

    await expect(getExpenseCountsForTags([5, 6, 7])).resolves.toEqual({
      5: 1,
      6: 2,
      7: 0,
    })
  })

  it('caps tag and expense count lookups at 500 ids per batch', async () => {
    const tagIds = Array.from({ length: 1001 }, (_, index) => index + 1)
    mocks.expenseTags.reset(
      tagIds.map((tagId) => ({
        id: tagId,
        expenseId: tagId,
        tagId,
        deletedAt: null,
      })),
    )
    mocks.expenses.reset(
      tagIds.map((expenseId) => ({
        id: expenseId,
        deletedAt: null,
      })),
    )

    const counts = await getExpenseCountsForTags(tagIds)

    expect(counts[1]).toBe(1)
    expect(counts[500]).toBe(1)
    expect(counts[501]).toBe(1)
    expect(counts[1001]).toBe(1)
    expect(mocks.expenseTags.anyOfCalls).toHaveLength(3)
    expect(mocks.expenseTags.anyOfCalls[0] as unknown[]).toHaveLength(500)
    expect(mocks.expenseTags.anyOfCalls[1] as unknown[]).toHaveLength(500)
    expect(mocks.expenseTags.anyOfCalls[2] as unknown[]).toHaveLength(1)
    expect(mocks.expenses.bulkGetCalls).toHaveLength(3)
    expect(mocks.expenses.bulkGetCalls[0]).toHaveLength(500)
    expect(mocks.expenses.bulkGetCalls[1]).toHaveLength(500)
    expect(mocks.expenses.bulkGetCalls[2]).toHaveLength(1)
  })

  it('merges tags with duplicate-tombstone tracking and can revert safely', async () => {
    mocks.tags.reset([
      { id: 1, name: 'Alpha', normalizedName: 'alpha', isArchived: false, deletedAt: null },
      { id: 2, name: 'Beta', normalizedName: 'beta', isArchived: false, deletedAt: null },
    ])
    mocks.expenseTags.reset([
      {
        id: 11,
        expenseId: 1001,
        tagId: 1,
        deletedAt: null,
        localId: 'join-11',
        syncStatus: 'synced',
      },
      {
        id: 12,
        expenseId: 1002,
        tagId: 1,
        deletedAt: null,
        localId: 'join-12',
        syncStatus: 'synced',
      },
      {
        id: 13,
        expenseId: 1002,
        tagId: 2,
        deletedAt: null,
        localId: 'join-13',
        syncStatus: 'synced',
      },
    ])

    const mergeId = await mergeTag(1, 2)

    const mergedRows = await mocks.expenseTags.toArray()
    expect(mergedRows.find((row) => row.id === 11)).toEqual(
      expect.objectContaining({ tagId: 2, deletedAt: null, syncStatus: 'pending' }),
    )
    expect(mergedRows.find((row) => row.id === 12)).toEqual(
      expect.objectContaining({ tagId: 1, deletedAt: expect.any(String), syncStatus: 'pending' }),
    )
    expect(await mocks.tags.get(1)).toEqual(expect.objectContaining({ isArchived: true }))
    expect(await mocks.tagMergeHistory.get(mergeId)).toEqual(
      expect.objectContaining({
        sourceTagId: 1,
        targetTagId: 2,
        affectedExpenseTagIds: [11],
        duplicateExpenseTagIds: [12],
        revertedAt: null,
      }),
    )

    await revertTagMerge(mergeId)

    const revertedRows = await mocks.expenseTags.toArray()
    expect(revertedRows.find((row) => row.id === 11)).toEqual(
      expect.objectContaining({ tagId: 1, deletedAt: null, syncStatus: 'pending' }),
    )
    expect(revertedRows.find((row) => row.id === 12)).toEqual(
      expect.objectContaining({ tagId: 1, deletedAt: null, syncStatus: 'pending' }),
    )
    expect(await mocks.tags.get(1)).toEqual(expect.objectContaining({ isArchived: false }))
    expect(await mocks.tagMergeHistory.get(mergeId)).toEqual(
      expect.objectContaining({
        revertedAt: expect.any(String),
        syncStatus: 'pending',
      }),
    )
  })
})
