import db from '../db/schema'
import { debugLog, debugWarn } from '../../utils/debug'

function hasLocalId<T extends { id?: number }>(item: T): item is T & { id: number } {
  return item.id != null
}

type NamedSyncRow = {
  id?: number
  name?: string
  normalizedName?: string
  localId?: string
  cloudId?: string | null
  updatedAt?: string
  deletedAt?: string | null
}

export async function deduplicateByName(
  table: {
    toArray: () => Promise<Array<Record<string, unknown>>>
    delete: (id: number) => Promise<void>
    update: (id: number, changes: Record<string, unknown>) => Promise<number>
  },
  fkField: 'categoryId' | 'payeeId',
): Promise<void> {
  const rows = await table.toArray()
  const groups = new Map<string, Array<Record<string, unknown>>>()

  for (const row of rows) {
    const key = (row.name as string)?.trim().toLowerCase()
    if (!key) continue
    const group = groups.get(key) || []
    group.push(row)
    groups.set(key, group)
  }

  for (const [, group] of groups) {
    if (group.length <= 1) continue
    group.sort((a, b) => {
      const aTime = new Date((a.updatedAt as string) || 0).getTime()
      const bTime = new Date((b.updatedAt as string) || 0).getTime()
      return bTime - aTime
    })
    const [keep, ...dupes] = group
    for (const dup of dupes) {
      const oldId = dup.id as number
      const newId = keep.id as number

      if (fkField === 'categoryId') {
        await db.expenses.where('categoryId').equals(oldId).modify({ categoryId: newId })
      } else {
        await db.expenses.where('payeeId').equals(oldId).modify({ payeeId: newId })
      }

      const queueItems = await db.syncQueue.toArray()
      const toUpdate = queueItems.filter(
        (item) => item.table === 'expenses' && (item.payload[fkField] as number) === oldId,
      )
      for (const item of toUpdate) {
        await db.syncQueue.update(item.id as number, {
          payload: { ...item.payload, [fkField]: newId },
        })
      }

      if (fkField === 'categoryId') {
        const schedules = await db.schedules.where('categoryId').equals(oldId).toArray()
        for (const s of schedules) {
          await db.schedules.update(s.id as number, { categoryId: newId })
        }
      }

      await table.delete(oldId)
    }
  }
}

export async function verifySyncIntegrity(): Promise<void> {
  const tagsPromise =
    'tags' in db
      ? (db as unknown as { tags: { toArray: () => Promise<NamedSyncRow[]> } }).tags.toArray()
      : Promise.resolve([])
  const expenseTagsPromise =
    'expenseTags' in db
      ? (
          db as unknown as {
            expenseTags: { toArray: () => Promise<Array<{ deletedAt?: string | null; tagId: number; expenseId: number }>> }
          }
        ).expenseTags.toArray()
      : Promise.resolve([])
  const [cats, pays, exps, splits, tags, expenseTags] = await Promise.all([
    db.categories.toArray(),
    db.payees.toArray(),
    db.expenses.toArray(),
    db.expenseSplits.toArray(),
    tagsPromise,
    expenseTagsPromise,
  ])
  const activeCats = cats.filter((category) => category.deletedAt == null)
  const activePays = pays.filter((payee) => payee.deletedAt == null)
  const activeExpenses = exps.filter((expense) => expense.deletedAt == null)
  const validCatIds = new Set(activeCats.filter(hasLocalId).map((c) => c.id))
  const validPayeeIds = new Set(activePays.filter(hasLocalId).map((p) => p.id))
  const validTagIds = new Set(tags.filter((tag) => tag.deletedAt == null && tag.id != null).map((tag) => tag.id as number))
  const validExpenseIds = new Set(activeExpenses.filter(hasLocalId).map((expense) => expense.id))
  const activeSplitIds = new Set(
    splits
      .filter((split) => split.deletedAt == null && split.id != null)
      .map((split) => split.id as number),
  )
  const tombstonedSplitIds = new Set(
    splits
      .filter((split) => split.deletedAt != null && split.id != null)
      .map((split) => split.id as number),
  )

  let brokenCats = 0
  let brokenPayees = 0
  let brokenSplitRefs = 0
  let tombstonedSplitRefs = 0
  let brokenExpenseTagRefs = 0
  for (const e of activeExpenses) {
    if (e.categoryId != null && !validCatIds.has(e.categoryId)) {
      brokenCats++
      if (brokenCats <= 3) {
        console.warn(
          '[integrity] expense',
          e.id,
          'references missing categoryId:',
          e.categoryId,
          'cloudId:',
          e.cloudId,
        )
      }
    }
    if (e.payeeId != null && !validPayeeIds.has(e.payeeId)) {
      brokenPayees++
      if (brokenPayees <= 3) {
        console.warn(
          '[integrity] expense',
          e.id,
          'references missing payeeId:',
          e.payeeId,
          'cloudId:',
          e.cloudId,
        )
      }
    }
    if (e.splitId != null && !activeSplitIds.has(e.splitId)) {
      if (tombstonedSplitIds.has(e.splitId)) {
        tombstonedSplitRefs++
        if (tombstonedSplitRefs <= 3) {
          console.warn(
            '[integrity] expense',
            e.id,
            'references tombstoned splitId:',
            e.splitId,
            'cloudId:',
            e.cloudId,
          )
        }
      } else {
        brokenSplitRefs++
        if (brokenSplitRefs <= 3) {
          console.warn(
            '[integrity] expense',
            e.id,
            'references missing splitId:',
            e.splitId,
            'cloudId:',
            e.cloudId,
          )
        }
      }
    }
  }
  for (const link of expenseTags.filter((row) => row.deletedAt == null)) {
    if (!validTagIds.has(link.tagId) || !validExpenseIds.has(link.expenseId)) {
      brokenExpenseTagRefs++
    }
  }
  const duplicateCategories = logDuplicateActiveNames('category', activeCats)
  const duplicatePayees = logDuplicateActiveNames('payee', activePays)
  const duplicateTags = logDuplicateActiveNames('tag', tags.filter((tag) => tag.deletedAt == null))
  const tombstoneConflicts = await logTombstoneConflicts()
  if (brokenCats > 0) {
    debugWarn('[integrity] total expenses with broken category link:', brokenCats)
  }
  if (brokenPayees > 0) {
    debugWarn('[integrity] total expenses with broken payee link:', brokenPayees)
  }
  if (brokenSplitRefs > 0) {
    debugWarn('[integrity] total expenses with broken split link:', brokenSplitRefs)
  }
  if (tombstonedSplitRefs > 0) {
    debugWarn(
      '[integrity] total expenses with tombstoned split link:',
      tombstonedSplitRefs,
    )
  }
  debugLog(
    '[integrity] checked',
    exps.length,
    'expenses,',
    cats.length,
    'categories —',
    brokenCats,
    'broken,',
    brokenPayees,
    'broken payees,',
    brokenSplitRefs,
    'broken split links,',
    tombstonedSplitRefs,
    'tombstoned split links,',
    duplicateCategories,
    'duplicate categories,',
    duplicatePayees,
    'duplicate payees,',
    duplicateTags,
    'duplicate tags,',
    brokenExpenseTagRefs,
    'broken expense-tag links,',
    tombstoneConflicts,
    'tombstone conflicts',
  )
}

function resolveNormalizedName(row: NamedSyncRow): string | null {
  if (typeof row.normalizedName === 'string' && row.normalizedName.length > 0) {
    return row.normalizedName
  }
  if (typeof row.name === 'string') {
    return row.name.trim().toLowerCase().replace(/\s+/g, ' ')
  }
  return null
}

function logDuplicateActiveNames(label: 'category' | 'payee' | 'tag', rows: NamedSyncRow[]): number {
  const groups = new Map<string, NamedSyncRow[]>()
  for (const row of rows) {
    const normalizedName = resolveNormalizedName(row)
    if (!normalizedName) continue
    const group = groups.get(normalizedName) ?? []
    group.push(row)
    groups.set(normalizedName, group)
  }

  let duplicateCount = 0
  for (const [normalizedName, group] of groups) {
    if (group.length < 2) continue
    duplicateCount += group.length - 1
    console.warn(
      `[integrity] duplicate active ${label} normalizedName:`,
      normalizedName,
      'ids:',
      group.map((row) => row.id),
    )
  }
  return duplicateCount
}

async function logTombstoneConflicts(): Promise<number> {
  const tableNames = [
    'expenses',
    'categories',
    'payees',
    'fixedExpenses',
    'fixedExpenseSnapshots',
    'incomeSnapshots',
    'savingsSnapshots',
    'schedules',
    'expenseSplits',
    'tags',
    'expenseTags',
    'categoryMergeHistory',
    'payeeMergeHistory',
    'tagMergeHistory',
  ] as const

  let conflicts = 0
  for (const tableName of tableNames) {
    let rows: NamedSyncRow[] = []
    try {
      rows = (await db.table(tableName).toArray()) as NamedSyncRow[]
    } catch {
      continue
    }
    const groups = new Map<string, NamedSyncRow[]>()

    for (const row of rows) {
      const identityKey =
        typeof row.localId === 'string' && row.localId.length > 0
          ? `local:${row.localId}`
          : typeof row.cloudId === 'string' && row.cloudId.length > 0
            ? `cloud:${row.cloudId}`
            : null
      if (!identityKey) continue
      const group = groups.get(identityKey) ?? []
      group.push(row)
      groups.set(identityKey, group)
    }

    for (const [identityKey, group] of groups) {
      if (group.length < 2) continue
      const newestTombstone = group
        .filter((row) => row.deletedAt != null)
        .sort(
          (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
        )[0]
      if (!newestTombstone) continue

      const olderActive = group.find(
        (row) =>
          row.deletedAt == null &&
          new Date(row.updatedAt ?? 0).getTime() <
            new Date(newestTombstone.updatedAt ?? 0).getTime(),
      )
      if (!olderActive) continue

      conflicts += 1
      console.warn(
        '[integrity] older active row conflicts with newer tombstone:',
        tableName,
        identityKey,
      )
    }
  }

  return conflicts
}
