import type {
  Expense,
  ExpenseTag,
  Tag,
  TagMergeHistory,
  TagUnlinkDeleteUndoPayload,
} from '../../types'
import { normalizeNameForSync } from '../../utils/syncMetadata'
import db from '../db/schema'
import { buildCreatedSyncRecord, filterActiveRows, markPendingActiveRecord } from './common'

const TAG_COUNT_BATCH_SIZE = 500

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function findTagsByNormalizedName(normalizedName: string): Promise<Tag[]> {
  return db.tags.where('normalizedName').equals(normalizedName).toArray()
}

export async function getAllTags(): Promise<Tag[]> {
  return db.tags.toArray()
}

export async function getTags(): Promise<Tag[]> {
  return filterActiveRows(await getAllTags())
}

export async function getActiveTags(): Promise<Tag[]> {
  return (await getTags()).filter((row) => row.isArchived !== true)
}

export async function addTag(name: string): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Tag name is required')
  const normalizedName = normalizeNameForSync(trimmed)
  const matches = await findTagsByNormalizedName(normalizedName)
  const now = new Date().toISOString()
  const active = matches.find((row) => row.deletedAt == null)
  if (active && active.id != null) {
    if (active.isArchived) {
      await db.tags.put({
        ...active,
        ...markPendingActiveRecord(active, now),
        id: active.id,
        name: trimmed,
        normalizedName,
        isArchived: false,
      })
      return active.id
    }
    throw new Error('A tag with that name already exists')
  }

  const tombstoned = matches.find((row) => row.deletedAt != null)
  if (tombstoned && tombstoned.id != null) {
    await db.tags.put({
      ...tombstoned,
      ...markPendingActiveRecord(tombstoned, now),
      id: tombstoned.id,
      name: trimmed,
      normalizedName,
      isArchived: false,
    })
    return tombstoned.id
  }

  return db.tags.add(
    buildCreatedSyncRecord(
      {
        name: trimmed,
        normalizedName,
        isArchived: false,
      },
      now,
    ) as Tag,
  )
}

export async function updateTag(id: number, changes: Partial<Tag>): Promise<void> {
  const existing = await db.tags.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  const nextName = changes.name?.trim()
  const normalizedName = nextName ? normalizeNameForSync(nextName) : existing.normalizedName

  if (normalizedName) {
    const duplicates = filterActiveRows(await findTagsByNormalizedName(normalizedName)).filter(
      (row) => row.id !== id,
    )
    if (duplicates.length > 0) throw new Error('A tag with that name already exists')
  }

  await db.tags.put({
    ...existing,
    ...changes,
    ...markPendingActiveRecord(existing, now),
    id,
    name: nextName ?? existing.name,
    normalizedName,
  })
}

export async function archiveTag(id: number): Promise<void> {
  const existing = await db.tags.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  await db.tags.put({
    ...existing,
    ...markPendingActiveRecord(existing, now),
    id,
    isArchived: true,
  })
}

export async function unarchiveTag(id: number): Promise<void> {
  const existing = await db.tags.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  await db.tags.put({
    ...existing,
    ...markPendingActiveRecord(existing, now),
    id,
    isArchived: false,
  })
}

export async function unlinkAllAndArchiveTag(id: number): Promise<TagUnlinkDeleteUndoPayload> {
  const now = new Date().toISOString()

  return db.transaction(
    'rw',
    db.tags,
    db.expenseTags,
    async (): Promise<TagUnlinkDeleteUndoPayload> => {
      const existing = await db.tags.get(id)
      if (!existing) {
        return { tagId: id, unlinkedExpenseTagIds: [] }
      }

      const activeRows = filterActiveRows(await db.expenseTags.where('tagId').equals(id).toArray())
      const unlinkedExpenseTagIds: number[] = []
      for (const row of activeRows) {
        if (row.id == null) continue
        unlinkedExpenseTagIds.push(row.id)
        await db.expenseTags.put({
          ...row,
          ...markPendingActiveRecord(row, now),
          id: row.id,
          deletedAt: now,
        } as ExpenseTag)
      }

      await db.tags.put({
        ...existing,
        ...markPendingActiveRecord(existing, now),
        id,
        isArchived: true,
      })

      return { tagId: id, unlinkedExpenseTagIds }
    },
  )
}

export async function undoUnlinkAllAndArchiveTag(
  payload: TagUnlinkDeleteUndoPayload,
): Promise<void> {
  const now = new Date().toISOString()

  await db.transaction('rw', db.tags, db.expenseTags, async (): Promise<void> => {
    const rows = await db.expenseTags.bulkGet(payload.unlinkedExpenseTagIds)
    for (const row of rows) {
      if (!row || row.id == null || row.tagId !== payload.tagId || row.deletedAt == null) continue
      await db.expenseTags.put({
        ...row,
        ...markPendingActiveRecord(row, now),
        id: row.id,
        deletedAt: null,
      } as ExpenseTag)
    }

    const existing = await db.tags.get(payload.tagId)
    if (!existing) return
    await db.tags.put({
      ...existing,
      ...markPendingActiveRecord(existing, now),
      id: payload.tagId,
      isArchived: false,
    })
  })
}

export async function getExpenseCountForTag(tagId: number): Promise<number> {
  const counts = await getExpenseCountsForTags([tagId])
  return counts[tagId] ?? 0
}

export async function getExpenseCountsForTags(tagIds: number[]): Promise<Record<number, number>> {
  const distinctTagIds = Array.from(new Set(tagIds))
  const counts: Record<number, number> = {}
  if (distinctTagIds.length === 0) return counts

  for (const id of distinctTagIds) {
    counts[id] = 0
  }

  const activeJoins: ExpenseTag[] = []
  for (const tagIdBatch of chunkArray(distinctTagIds, TAG_COUNT_BATCH_SIZE)) {
    const batchRows = await db.expenseTags.where('tagId').anyOf(tagIdBatch).toArray()
    activeJoins.push(...filterActiveRows(batchRows))
  }
  if (activeJoins.length === 0) return counts

  const distinctExpenseIds = Array.from(new Set(activeJoins.map((row) => row.expenseId)))
  const expenses: Expense[] = []
  for (const expenseIdBatch of chunkArray(distinctExpenseIds, TAG_COUNT_BATCH_SIZE)) {
    const batchRows = await db.expenses.bulkGet(expenseIdBatch)
    expenses.push(...batchRows.filter((row): row is Expense => Boolean(row)))
  }
  const activeExpenseIds = new Set(
    filterActiveRows(expenses).map((expense) => expense.id),
  )

  const expenseIdsByTag = new Map<number, Set<number>>()
  for (const join of activeJoins) {
    if (!activeExpenseIds.has(join.expenseId)) continue
    const existing = expenseIdsByTag.get(join.tagId) ?? new Set<number>()
    existing.add(join.expenseId)
    expenseIdsByTag.set(join.tagId, existing)
  }

  for (const [tagId, expenseIds] of expenseIdsByTag) {
    counts[tagId] = expenseIds.size
  }

  return counts
}

export async function mergeTag(sourceTagId: number, targetTagId: number): Promise<number> {
  if (sourceTagId === targetTagId) {
    throw new Error('Cannot merge a tag into itself.')
  }

  const now = new Date().toISOString()

  return db.transaction(
    'rw',
    db.tags,
    db.expenseTags,
    db.tagMergeHistory,
    async (): Promise<number> => {
      const sourceTag = await db.tags.get(sourceTagId)
      if (!sourceTag) {
        throw new Error('Source tag not found.')
      }
      const targetTag = await db.tags.get(targetTagId)
      if (!targetTag) {
        throw new Error('Target tag not found.')
      }

      const sourceRows = filterActiveRows(await db.expenseTags.where('tagId').equals(sourceTagId).toArray())
      const targetRows = filterActiveRows(await db.expenseTags.where('tagId').equals(targetTagId).toArray())
      const targetExpenseIds = new Set(targetRows.map((row) => row.expenseId))

      const affectedExpenseTagIds: number[] = []
      const duplicateExpenseTagIds: number[] = []

      for (const row of sourceRows) {
        if (row.id == null) continue
        if (targetExpenseIds.has(row.expenseId)) {
          duplicateExpenseTagIds.push(row.id)
          await db.expenseTags.put({
            ...row,
            ...markPendingActiveRecord(row, now),
            id: row.id,
            deletedAt: now,
          } as ExpenseTag)
          continue
        }

        affectedExpenseTagIds.push(row.id)
        await db.expenseTags.put({
          ...row,
          ...markPendingActiveRecord(row, now),
          id: row.id,
          tagId: targetTagId,
        } as ExpenseTag)
      }

      const mergeId = await db.tagMergeHistory.add(
        buildCreatedSyncRecord(
          {
            sourceTagId,
            targetTagId,
            affectedExpenseTagIds,
            duplicateExpenseTagIds,
            revertedAt: null,
          },
          now,
        ) as TagMergeHistory,
      )

      await db.tags.put({
        ...sourceTag,
        ...markPendingActiveRecord(sourceTag, now),
        id: sourceTagId,
        isArchived: true,
      })

      return mergeId
    },
  )
}

export async function revertTagMerge(mergeId: number): Promise<void> {
  const mergeRow = await db.tagMergeHistory.get(mergeId)
  if (!mergeRow || mergeRow.revertedAt) {
    throw new Error('Merge record not found or already reverted.')
  }

  const now = new Date().toISOString()

  await db.transaction(
    'rw',
    db.tags,
    db.expenseTags,
    db.tagMergeHistory,
    async (): Promise<void> => {
      const affectedRows = await db.expenseTags.bulkGet(mergeRow.affectedExpenseTagIds)
      for (const row of affectedRows) {
        if (!row || row.id == null || row.deletedAt != null || row.tagId !== mergeRow.targetTagId) {
          continue
        }

        const existingSourceRows = filterActiveRows(
          await db.expenseTags.where('expenseId').equals(row.expenseId).toArray(),
        ).filter((join) => join.tagId === mergeRow.sourceTagId && join.id !== row.id)
        if (existingSourceRows.length > 0) continue

        await db.expenseTags.put({
          ...row,
          ...markPendingActiveRecord(row, now),
          id: row.id,
          tagId: mergeRow.sourceTagId,
        } as ExpenseTag)
      }

      const duplicateRows = await db.expenseTags.bulkGet(mergeRow.duplicateExpenseTagIds)
      for (const row of duplicateRows) {
        if (!row || row.id == null || row.tagId !== mergeRow.sourceTagId || row.deletedAt == null) {
          continue
        }

        const existingSourceRows = filterActiveRows(
          await db.expenseTags.where('expenseId').equals(row.expenseId).toArray(),
        ).filter((join) => join.tagId === mergeRow.sourceTagId && join.id !== row.id)
        if (existingSourceRows.length > 0) continue

        await db.expenseTags.put({
          ...row,
          ...markPendingActiveRecord(row, now),
          id: row.id,
          deletedAt: null,
        } as ExpenseTag)
      }

      const sourceTag = await db.tags.get(mergeRow.sourceTagId)
      if (sourceTag) {
        await db.tags.put({
          ...sourceTag,
          ...markPendingActiveRecord(sourceTag, now),
          id: sourceTag.id as number,
          isArchived: false,
        } as Tag)
      }

      await db.tagMergeHistory.put({
        ...mergeRow,
        ...markPendingActiveRecord(mergeRow, now),
        id: mergeId,
        revertedAt: now,
      } as TagMergeHistory)
    },
  )
}

export async function getTagIdsForExpense(expenseId: number): Promise<number[]> {
  const joins = filterActiveRows(await db.expenseTags.where('expenseId').equals(expenseId).toArray())
  return joins.map((row) => row.tagId)
}

export async function getTagsForExpense(expenseId: number): Promise<Tag[]> {
  const joins = filterActiveRows(await db.expenseTags.where('expenseId').equals(expenseId).toArray())
  const tags = await db.tags.bulkGet(joins.map((row) => row.tagId))
  return filterActiveRows(tags.filter((row): row is Tag => Boolean(row)))
}

export async function getExpenseTagsMap(expenseIds: number[]): Promise<Record<number, Tag[]>> {
  const map: Record<number, Tag[]> = {}
  if (expenseIds.length === 0) return map
  const expenseIdSet = new Set(expenseIds)
  const joins = filterActiveRows(await db.expenseTags.toArray()).filter((row) =>
    expenseIdSet.has(row.expenseId),
  )
  if (joins.length === 0) return map
  const tagIds = Array.from(new Set(joins.map((join) => join.tagId)))
  const tags = filterActiveRows((await db.tags.bulkGet(tagIds)).filter((row): row is Tag => Boolean(row)))
  const tagById = new Map(tags.filter((tag) => tag.id != null).map((tag) => [tag.id as number, tag]))

  for (const expenseId of expenseIds) {
    map[expenseId] = []
  }
  for (const join of joins) {
    const tag = tagById.get(join.tagId)
    if (!tag) continue
    map[join.expenseId].push(tag)
  }
  return map
}

export async function setExpenseTags(expenseId: number, tagIds: number[]): Promise<void> {
  const now = new Date().toISOString()
  const nextTagIds = new Set(tagIds)
  await db.transaction('rw', db.expenseTags, async () => {
    const allRows = await db.expenseTags.where('expenseId').equals(expenseId).toArray()
    const byTagId = new Map(allRows.map((row) => [row.tagId, row] as const))
    const activeRows = filterActiveRows(allRows)

    for (const row of activeRows) {
      if (nextTagIds.has(row.tagId)) continue
      if (row.id == null) continue
      await db.expenseTags.put({
        ...row,
        ...markPendingActiveRecord(row, now),
        id: row.id,
        deletedAt: now,
      } as ExpenseTag)
    }

    for (const tagId of nextTagIds) {
      const existing = byTagId.get(tagId)
      if (existing && existing.id != null) {
        if (existing.deletedAt != null) {
          await db.expenseTags.put({
            ...existing,
            ...markPendingActiveRecord(existing, now),
            id: existing.id,
            deletedAt: null,
          } as ExpenseTag)
        }
        continue
      }
      await db.expenseTags.add(
        buildCreatedSyncRecord(
          {
            expenseId,
            tagId,
          },
          now,
        ) as ExpenseTag,
      )
    }
  })
}

export async function setTagsForExpenses(expenseIds: number[], tagIds: number[]): Promise<void> {
  for (const expenseId of expenseIds) {
    await setExpenseTags(expenseId, tagIds)
  }
}
