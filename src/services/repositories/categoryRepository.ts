import type { Category, CategoryMergeHistory } from '../../types'
import db from '../db/schema'
import { enqueue } from './common'

export async function getCategories(): Promise<Category[]> {
  return db.categories.toArray()
}

export async function addCategory(name: string): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name is required')
  const existing = await db.categories.where('name').equalsIgnoreCase(trimmed).first()
  if (existing) {
    if (existing.isArchived) {
      await db.categories.update(existing.id as number, {
        name: trimmed,
        isArchived: false,
      })
      const row = await db.categories.get(existing.id as number)
      await enqueue('categories', 'update', row as unknown as Record<string, unknown>)
      return existing.id as number
    }
    throw new Error('A category with that name already exists')
  }
  const now = new Date().toISOString()
  const id = await db.categories.add({
    name: trimmed,
    cloudId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    isArchived: false,
  } as Category)
  const row = await db.categories.get(id)
  await enqueue('categories', 'insert', row as unknown as Record<string, unknown>)
  return id
}

export async function ensureForImport(names: string[]): Promise<Record<string, number>> {
  const trimmedNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  const categoryMap: Record<string, number> = {}
  if (trimmedNames.length === 0) return categoryMap

  await db.transaction('rw', db.categories, async () => {
    for (const name of trimmedNames) {
      const existing = await db.categories.where('name').equalsIgnoreCase(name).first()
      if (existing) {
        if (existing.isArchived) {
          await db.categories.update(existing.id as number, {
            name,
            isArchived: false,
            updatedAt: new Date().toISOString(),
          })
        }
        categoryMap[name] = existing.id as number
        continue
      }

      const now = new Date().toISOString()
      const id = await db.categories.add({
        name,
        cloudId: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      } as Category)
      categoryMap[name] = id
    }
  })

  return categoryMap
}

export async function updateCategory(id: number, changes: Partial<Category>): Promise<void> {
  if (changes.name) {
    changes.name = changes.name.trim()
  }
  await db.categories.update(id, { ...changes, updatedAt: new Date().toISOString() })
  const row = await db.categories.get(id)
  await enqueue('categories', 'update', row as unknown as Record<string, unknown>)
}

export async function deleteCategory(id: number): Promise<void> {
  await db.categories.update(id, { isArchived: true })
  const row = await db.categories.get(id)
  await enqueue('categories', 'update', row as unknown as Record<string, unknown>)
}

export async function mergeCategory(
  sourceCategoryId: number,
  targetCategoryId: number,
): Promise<number> {
  if (sourceCategoryId === targetCategoryId) {
    throw new Error('Cannot merge a category into itself.')
  }
  const now = new Date().toISOString()

  const affected = await db.expenses.where('categoryId').equals(sourceCategoryId).toArray()
  const affectedIds = affected.map((e) => e.id as number)

  if (affectedIds.length > 0) {
    await db.expenses
      .where('categoryId')
      .equals(sourceCategoryId)
      .modify({ categoryId: targetCategoryId })
    const updatedExpenses = await db.expenses.bulkGet(affectedIds)
    for (const expense of updatedExpenses) {
      if (!expense) continue
      await enqueue('expenses', 'update', expense as unknown as Record<string, unknown>)
    }
  }

  const mergeId = await db.categoryMergeHistory.add({
    cloudId: crypto.randomUUID(),
    sourceCategoryId,
    targetCategoryId,
    affectedExpenseIds: affectedIds,
    createdAt: now,
    updatedAt: now,
    revertedAt: null,
  } as CategoryMergeHistory)
  const mergeRow = await db.categoryMergeHistory.get(mergeId)
  if (mergeRow) {
    await enqueue('categoryMergeHistory', 'insert', mergeRow as unknown as Record<string, unknown>)
  }

  await db.categories.update(sourceCategoryId, {
    isArchived: true,
    archivedAt: now,
    mergedIntoCategoryId: targetCategoryId,
    updatedAt: now,
  })
  const updatedCat = await db.categories.get(sourceCategoryId)
  await enqueue('categories', 'update', updatedCat as unknown as Record<string, unknown>)

  return mergeId
}

export async function revertCategoryMerge(mergeId: number): Promise<void> {
  const mergeRow = await db.categoryMergeHistory.get(mergeId)
  if (!mergeRow || mergeRow.revertedAt) {
    throw new Error('Merge record not found or already reverted.')
  }
  const now = new Date().toISOString()

  // Revert expenses back to source category
  if (mergeRow.affectedExpenseIds.length > 0) {
    await db.expenses.bulkUpdate(
      mergeRow.affectedExpenseIds.map((id) => ({
        key: id,
        changes: { categoryId: mergeRow.sourceCategoryId },
      })),
    )
    const revertedExpenses = await db.expenses.bulkGet(mergeRow.affectedExpenseIds)
    for (const expense of revertedExpenses) {
      if (!expense) continue
      await enqueue('expenses', 'update', expense as unknown as Record<string, unknown>)
    }
  }

  // Un-archive the source category
  await db.categories.update(mergeRow.sourceCategoryId, {
    isArchived: false,
    archivedAt: undefined,
    mergedIntoCategoryId: null,
    updatedAt: now,
  } as Partial<Category>)

  // Mark merge as reverted
  await db.categoryMergeHistory.update(mergeId, { revertedAt: now })
  const updatedMerge = await db.categoryMergeHistory.get(mergeId)
  await enqueue(
    'categoryMergeHistory',
    'update',
    updatedMerge as unknown as Record<string, unknown>,
  )

  const updatedCat = await db.categories.get(mergeRow.sourceCategoryId)
  await enqueue('categories', 'update', updatedCat as unknown as Record<string, unknown>)
}
