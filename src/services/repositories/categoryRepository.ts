import type { Category, CategoryMergeHistory, Expense } from '../../types'
import { normalizeNameForSync } from '../../utils/syncMetadata'
import db from '../db/schema'
import { buildCreatedSyncRecord, filterActiveRows, markPendingActiveRecord } from './common'

export async function getAllCategories(): Promise<Category[]> {
  return db.categories.toArray()
}

export async function getCategories(): Promise<Category[]> {
  return filterActiveRows(await getAllCategories())
}

async function findByNormalizedName(normalizedName: string): Promise<Category[]> {
  return db.categories.where('normalizedName').equals(normalizedName).toArray()
}

export async function addCategory(name: string): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name is required')

  const normalizedName = normalizeNameForSync(trimmed)
  const matches = await findByNormalizedName(normalizedName)
  const active = matches.find((row) => row.deletedAt == null)
  const now = new Date().toISOString()

  if (active) {
    if (active.isArchived && active.id != null) {
      await db.categories.put({
        ...active,
        ...markPendingActiveRecord(active, now),
        id: active.id,
        name: trimmed,
        normalizedName,
        isArchived: false,
        archivedAt: undefined,
        mergedIntoCategoryId: null,
      })
      return active.id
    }
    throw new Error('A category with that name already exists')
  }

  const tombstoned = matches.find((row) => row.deletedAt != null)
  if (tombstoned && tombstoned.id != null) {
    await db.categories.put({
      ...tombstoned,
      ...markPendingActiveRecord(tombstoned, now),
      id: tombstoned.id,
      name: trimmed,
      normalizedName,
      isArchived: false,
      archivedAt: undefined,
      mergedIntoCategoryId: null,
    })
    return tombstoned.id
  }

  return db.categories.add(
    buildCreatedSyncRecord(
      {
        name: trimmed,
        normalizedName,
        isArchived: false,
      },
      now,
    ) as Category,
  )
}

export async function ensureForImport(names: string[]): Promise<Record<string, number>> {
  const trimmedNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  const categoryMap: Record<string, number> = {}
  if (trimmedNames.length === 0) return categoryMap

  await db.transaction('rw', db.categories, async () => {
    const now = new Date().toISOString()

    for (const name of trimmedNames) {
      const normalizedName = normalizeNameForSync(name)
      const matches = await findByNormalizedName(normalizedName)
      const active = matches.find((row) => row.deletedAt == null)

      if (active && active.id != null) {
        if (active.isArchived) {
          await db.categories.put({
            ...active,
            ...markPendingActiveRecord(active, now),
            id: active.id,
            name,
            normalizedName,
            isArchived: false,
            archivedAt: undefined,
            mergedIntoCategoryId: null,
          })
        }
        categoryMap[name] = active.id
        continue
      }

      const tombstoned = matches.find((row) => row.deletedAt != null)
      if (tombstoned && tombstoned.id != null) {
        await db.categories.put({
          ...tombstoned,
          ...markPendingActiveRecord(tombstoned, now),
          id: tombstoned.id,
          name,
          normalizedName,
          isArchived: false,
          archivedAt: undefined,
          mergedIntoCategoryId: null,
        })
        categoryMap[name] = tombstoned.id
        continue
      }

      const id = await db.categories.add(
        buildCreatedSyncRecord(
          {
            name,
            normalizedName,
            isArchived: false,
          },
          now,
        ) as Category,
      )
      categoryMap[name] = id
    }
  })

  return categoryMap
}

export async function updateCategory(id: number, changes: Partial<Category>): Promise<void> {
  const existing = await db.categories.get(id)
  if (!existing) return

  const now = new Date().toISOString()
  const nextName = changes.name?.trim()
  const normalizedName = nextName ? normalizeNameForSync(nextName) : existing.normalizedName

  if (normalizedName) {
    const duplicates = filterActiveRows(await findByNormalizedName(normalizedName)).filter(
      (row) => row.id !== id,
    )
    if (duplicates.length > 0) {
      throw new Error('A category with that name already exists')
    }
  }

  await db.categories.put({
    ...existing,
    ...changes,
    ...markPendingActiveRecord(existing, now),
    id,
    name: nextName ?? existing.name,
    normalizedName,
  })
}

export async function deleteCategory(id: number): Promise<void> {
  const existing = await db.categories.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  await db.categories.put({
    ...existing,
    ...markPendingActiveRecord(existing, now),
    id,
    isArchived: true,
    archivedAt: now,
  })
}

export async function unarchiveCategory(id: number): Promise<void> {
  const existing = await db.categories.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  await db.categories.put({
    ...existing,
    ...markPendingActiveRecord(existing, now),
    id,
    isArchived: false,
    archivedAt: undefined,
    mergedIntoCategoryId: null,
  })
}

export async function mergeCategory(
  sourceCategoryId: number,
  targetCategoryId: number,
): Promise<number> {
  if (sourceCategoryId === targetCategoryId) {
    throw new Error('Cannot merge a category into itself.')
  }

  const now = new Date().toISOString()
  const targetCategory = await db.categories.get(targetCategoryId)
  const sourceCategory = await db.categories.get(sourceCategoryId)
  if (!sourceCategory) {
    throw new Error('Source category not found.')
  }

  const affected = filterActiveRows(
    await db.expenses.where('categoryId').equals(sourceCategoryId).toArray(),
  )
  if (affected.length > 0) {
    const updates = affected
      .filter((expense) => expense.id != null)
      .map((expense) => ({
        ...expense,
        ...markPendingActiveRecord(expense, now),
        id: expense.id as number,
        categoryId: targetCategoryId,
        categoryNameSnapshot: targetCategory?.name ?? expense.categoryNameSnapshot ?? null,
      }))
    await db.expenses.bulkPut(updates as Expense[])
  }

  const mergeId = await db.categoryMergeHistory.add(
    buildCreatedSyncRecord(
      {
        sourceCategoryId,
        targetCategoryId,
        affectedExpenseIds: affected
          .map((expense) => expense.id)
          .filter((expenseId): expenseId is number => typeof expenseId === 'number'),
        revertedAt: null,
      },
      now,
    ) as CategoryMergeHistory,
  )

  await db.categories.put({
    ...sourceCategory,
    ...markPendingActiveRecord(sourceCategory, now),
    id: sourceCategoryId,
    isArchived: true,
    archivedAt: now,
    mergedIntoCategoryId: targetCategoryId,
  })

  return mergeId
}

export async function revertCategoryMerge(mergeId: number): Promise<void> {
  const mergeRow = await db.categoryMergeHistory.get(mergeId)
  if (!mergeRow || mergeRow.revertedAt) {
    throw new Error('Merge record not found or already reverted.')
  }

  const now = new Date().toISOString()
  const sourceCategory = await db.categories.get(mergeRow.sourceCategoryId)

  if (mergeRow.affectedExpenseIds.length > 0) {
    const affected = await db.expenses.bulkGet(mergeRow.affectedExpenseIds)
    const reverted = filterActiveRows(
      affected.filter((expense): expense is Expense => Boolean(expense)),
    )
      .filter((expense) => expense.id != null)
      .map((expense) => ({
        ...expense,
        ...markPendingActiveRecord(expense, now),
        id: expense.id as number,
        categoryId: mergeRow.sourceCategoryId,
        categoryNameSnapshot: sourceCategory?.name ?? expense.categoryNameSnapshot ?? null,
      }))
    if (reverted.length > 0) {
      await db.expenses.bulkPut(reverted)
    }
  }

  if (sourceCategory) {
    await db.categories.put({
      ...sourceCategory,
      ...markPendingActiveRecord(sourceCategory, now),
      id: mergeRow.sourceCategoryId,
      isArchived: false,
      archivedAt: undefined,
      mergedIntoCategoryId: null,
    } as Category)
  }

  await db.categoryMergeHistory.put({
    ...mergeRow,
    ...markPendingActiveRecord(mergeRow, now),
    id: mergeId,
    revertedAt: now,
  } as CategoryMergeHistory)
}
