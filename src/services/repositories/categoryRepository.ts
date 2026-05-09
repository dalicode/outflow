import type { Category, CategoryMergeHistory } from '../../types'
import { normalizeName } from '../../utils/normalizeName'
import db from '../db/schema'
import { enqueue } from './common'

export async function getCategories(): Promise<Category[]> {
  return db.categories.toArray()
}

export async function addCategory(name: string): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name is required')
  const normalized = normalizeName(trimmed)
  const existing = await db.categories.where('name').equalsIgnoreCase(trimmed).first()
  if (existing) {
    if (existing.isArchived) {
      await db.categories.update(existing.id as number, {
        name: normalized,
        isArchived: false,
      })
      const row = await db.categories.get(existing.id as number)
      await enqueue('categories', 'update', row as unknown as Record<string, unknown>)
      return existing.id as number
    }
    throw new Error('A category with that name already exists')
  }
  const id = await db.categories.add({
    name: normalized,
    createdAt: new Date().toISOString(),
    isArchived: false,
  } as Category)
  const row = await db.categories.get(id)
  await enqueue('categories', 'insert', row as unknown as Record<string, unknown>)
  return id
}

export async function updateCategory(id: number, changes: Partial<Category>): Promise<void> {
  if (changes.name) {
    changes.name = normalizeName(changes.name.trim())
  }
  await db.categories.update(id, changes)
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
): Promise<void> {
  if (sourceCategoryId === targetCategoryId) {
    throw new Error('Cannot merge a category into itself.')
  }
  const now = new Date().toISOString()
  await db.transaction('rw', [db.expenses, db.categories, db.categoryMergeHistory], async () => {
    const affected = await db.expenses.where('categoryId').equals(sourceCategoryId).toArray()
    const affectedIds = affected.map((e) => e.id as number)

    if (affectedIds.length > 0) {
      await db.expenses
        .where('categoryId')
        .equals(sourceCategoryId)
        .modify({ categoryId: targetCategoryId })
    }

    const mergeId = await db.categoryMergeHistory.add({
      sourceCategoryId,
      targetCategoryId,
      affectedExpenseIds: affectedIds,
      createdAt: now,
      revertedAt: null,
    } as CategoryMergeHistory)
    const mergeRow = await db.categoryMergeHistory.get(mergeId)
    if (mergeRow) {
      await enqueue(
        'categoryMergeHistory',
        'insert',
        mergeRow as unknown as Record<string, unknown>,
      )
    }

    await db.categories.update(sourceCategoryId, {
      isArchived: true,
      archivedAt: now,
      mergedIntoCategoryId: targetCategoryId,
      updatedAt: now,
    })
  })
  // Enqueue sync for affected records
  const updatedCat = await db.categories.get(sourceCategoryId)
  await enqueue('categories', 'update', updatedCat as unknown as Record<string, unknown>)
}
