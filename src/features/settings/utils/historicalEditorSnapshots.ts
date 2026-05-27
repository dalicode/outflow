import type { FixedExpenseSnapshot } from '../../../types'
import type { HistoricalFixedItem } from '../../../services/repositories/historicalSnapshotRepository'

let idCounter = 0

function nextId(): string {
  idCounter += 1
  return `tmp-${idCounter}`
}

export function fixedSnapshotsToItems(snapshots: FixedExpenseSnapshot[]): HistoricalFixedItem[] {
  const byDefinition = new Map<number, FixedExpenseSnapshot[]>()
  for (const snapshot of snapshots) {
    const existing = byDefinition.get(snapshot.fixedExpenseId) ?? []
    existing.push(snapshot)
    byDefinition.set(snapshot.fixedExpenseId, existing)
  }

  const fixedItems: HistoricalFixedItem[] = []
  for (const [fixedExpenseId, rows] of byDefinition) {
    const sortedRows = [...rows].sort((a, b) => a.month - b.month)
    let current: HistoricalFixedItem | null = null

    for (const row of sortedRows) {
      const name = row.nameSnapshot || 'Unknown'
      const amount = row.amountSnapshot
      const isContinuation =
        current != null &&
        current.endMonth + 1 === row.month &&
        current.name === name &&
        Number(current.amount) === amount

      if (isContinuation && current) {
        current.endMonth = row.month
        continue
      }

      if (current) fixedItems.push(current)
      current = {
        id: nextId(),
        name,
        amount,
        startMonth: row.month,
        endMonth: row.month,
        existingFixedExpenseId: fixedExpenseId,
      }
    }

    if (current) fixedItems.push(current)
  }

  return fixedItems
}

export function createTemporaryId(): string {
  return nextId()
}
