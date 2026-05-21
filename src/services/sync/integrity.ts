import db from '../db/schema'
import { debugLog, debugWarn } from '../../utils/debug'

function hasLocalId<T extends { id?: number }>(item: T): item is T & { id: number } {
  return item.id != null
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
  const [cats, pays, exps] = await Promise.all([
    db.categories.toArray(),
    db.payees.toArray(),
    db.expenses.toArray(),
  ])
  const validCatIds = new Set(cats.filter(hasLocalId).map((c) => c.id))
  const validPayeeIds = new Set(pays.filter(hasLocalId).map((p) => p.id))

  let brokenCats = 0
  let brokenPayees = 0
  for (const e of exps) {
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
  }
  if (brokenCats > 0) {
    debugWarn('[integrity] total expenses with broken category link:', brokenCats)
  }
  if (brokenPayees > 0) {
    debugWarn('[integrity] total expenses with broken payee link:', brokenPayees)
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
    'broken payees',
  )
}
