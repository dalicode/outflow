import type { ExpenseTag, Tag } from '../../types'
import { normalizeNameForSync } from '../../utils/syncMetadata'
import db from '../db/schema'
import { buildCreatedSyncRecord, filterActiveRows, markPendingActiveRecord } from './common'

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
