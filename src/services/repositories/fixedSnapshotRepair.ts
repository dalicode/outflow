import type { FixedExpenseSnapshot } from '../../types'
import { historicalValuesMatch, normalizeHistoricalValue } from '../../utils/historicalDataHelpers'
import { normalizeNameForSync } from '../../utils/syncMetadata'
import { markDeletedSyncRecord, markPendingActiveRecord } from './common'

type RepairableFixedSnapshot = FixedExpenseSnapshot & {
  id?: number
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

interface FixedSnapshotTable {
  put: (row: RepairableFixedSnapshot) => Promise<unknown>
}

function getTimestampMs(value?: string): number {
  if (typeof value !== 'string' || value.length === 0) return Number.NEGATIVE_INFINITY
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function compareSnapshotRows(a: RepairableFixedSnapshot, b: RepairableFixedSnapshot): number {
  const aActive = a.deletedAt == null ? 1 : 0
  const bActive = b.deletedAt == null ? 1 : 0
  if (aActive !== bActive) return bActive - aActive

  const aUpdatedAt = getTimestampMs(a.updatedAt)
  const bUpdatedAt = getTimestampMs(b.updatedAt)
  if (aUpdatedAt !== bUpdatedAt) return bUpdatedAt - aUpdatedAt

  const aCreatedAt = getTimestampMs(a.createdAt)
  const bCreatedAt = getTimestampMs(b.createdAt)
  if (aCreatedAt !== bCreatedAt) return bCreatedAt - aCreatedAt

  const aId = typeof a.id === 'number' ? a.id : Number.POSITIVE_INFINITY
  const bId = typeof b.id === 'number' ? b.id : Number.POSITIVE_INFINITY
  return aId - bId
}

function monthOrdinal(row: Pick<FixedExpenseSnapshot, 'year' | 'month'>): number {
  return row.year * 12 + row.month
}

function strictSnapshotKey(row: FixedExpenseSnapshot): string {
  return `${row.fixedExpenseId}-${row.year}-${row.month}`
}

function logicalSnapshotKey(row: FixedExpenseSnapshot): string {
  return `${normalizeNameForSync(row.nameSnapshot || 'Unknown')}|${normalizeHistoricalValue(
    row.amountSnapshot,
  )}`
}

function isSameLogicalSnapshot(
  row: FixedExpenseSnapshot,
  name: string,
  amount: number,
): boolean {
  return (
    normalizeNameForSync(row.nameSnapshot || 'Unknown') === normalizeNameForSync(name) &&
    historicalValuesMatch(row.amountSnapshot, amount)
  )
}

function activeRows(rows: RepairableFixedSnapshot[]): RepairableFixedSnapshot[] {
  return rows.filter((row) => row.deletedAt == null)
}

async function collapseStrictDuplicates(
  rows: RepairableFixedSnapshot[],
  table: FixedSnapshotTable,
  nowIso: string,
): Promise<RepairableFixedSnapshot[]> {
  const byStrictKey = new Map<string, RepairableFixedSnapshot[]>()
  for (const row of activeRows(rows)) {
    const group = byStrictKey.get(strictSnapshotKey(row)) ?? []
    group.push(row)
    byStrictKey.set(strictSnapshotKey(row), group)
  }

  for (const group of byStrictKey.values()) {
    if (group.length <= 1) continue
    const preferred = [...group].sort(compareSnapshotRows)[0]
    for (const duplicate of group) {
      if (duplicate.id == null || duplicate.id === preferred.id) continue
      const deleted = {
        ...duplicate,
        ...markDeletedSyncRecord(duplicate, nowIso),
        id: duplicate.id,
      }
      Object.assign(duplicate, deleted)
      await table.put(deleted)
    }
  }

  return rows
}

async function unifyContiguousLogicalRuns(
  rows: RepairableFixedSnapshot[],
  table: FixedSnapshotTable,
  nowIso: string,
): Promise<RepairableFixedSnapshot[]> {
  const byLogicalKey = new Map<string, RepairableFixedSnapshot[]>()
  for (const row of activeRows(rows)) {
    const key = logicalSnapshotKey(row)
    const group = byLogicalKey.get(key) ?? []
    group.push(row)
    byLogicalKey.set(key, group)
  }

  for (const group of byLogicalKey.values()) {
    const sorted = [...group].sort((a, b) => {
      const monthDiff = monthOrdinal(a) - monthOrdinal(b)
      return monthDiff !== 0 ? monthDiff : compareSnapshotRows(a, b)
    })

    let run: RepairableFixedSnapshot[] = []
    let previousOrdinal: number | null = null

    const flushRun = async () => {
      if (run.length <= 1) {
        run = []
        return
      }

      const earliestMonth = Math.min(...run.map(monthOrdinal))
      const earliestRows = run.filter((row) => monthOrdinal(row) === earliestMonth)
      const canonicalRow = [...earliestRows].sort(compareSnapshotRows)[0]
      const canonicalFixedExpenseId = canonicalRow.fixedExpenseId

      for (const row of run) {
        if (row.id == null || row.fixedExpenseId === canonicalFixedExpenseId) continue
        const updated = {
          ...row,
          ...markPendingActiveRecord(row, nowIso),
          id: row.id,
          fixedExpenseId: canonicalFixedExpenseId,
        }
        Object.assign(row, updated)
        await table.put(updated)
      }

      run = []
    }

    for (const row of sorted) {
      const currentOrdinal = monthOrdinal(row)
      if (previousOrdinal == null || currentOrdinal <= previousOrdinal + 1) {
        run.push(row)
      } else {
        await flushRun()
        run.push(row)
      }
      previousOrdinal = currentOrdinal
    }
    await flushRun()
  }

  return rows
}

export async function repairFixedSnapshotIdentitySplits(
  rows: FixedExpenseSnapshot[],
  table: FixedSnapshotTable,
  nowIso: string,
): Promise<FixedExpenseSnapshot[]> {
  const repairableRows = rows as RepairableFixedSnapshot[]
  await collapseStrictDuplicates(repairableRows, table, nowIso)
  await unifyContiguousLogicalRuns(repairableRows, table, nowIso)
  await collapseStrictDuplicates(repairableRows, table, nowIso)
  return activeRows(repairableRows)
}

export function resolveHistoricalFixedExpenseIdForSnapshot(
  rows: FixedExpenseSnapshot[],
  year: number,
  month: number,
  nameSnapshot: string,
  amountSnapshot: number,
  fallbackFixedExpenseId: number,
): number {
  const previousMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const previousMatches = rows.filter(
    (row) =>
      row.deletedAt == null &&
      row.year === previousMonth.year &&
      row.month === previousMonth.month &&
      isSameLogicalSnapshot(row, nameSnapshot, amountSnapshot),
  )

  if (previousMatches.length === 0) return fallbackFixedExpenseId
  return [...previousMatches].sort(compareSnapshotRows)[0].fixedExpenseId
}
