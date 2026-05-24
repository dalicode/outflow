import type {
  Category,
  CategoryMergeHistory,
  Expense,
  ExpenseSplit,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  Payee,
  PayeeMergeHistory,
  SavingsSnapshot,
  Schedule,
  SyncQueueItem,
} from '../../types'
import type { Setting } from '../db/schema'
import { decryptBackup, isEncryptedEnvelope } from '../../utils/backupCrypto'
import { normalizeImportedSyncMetadata, normalizeNameForSync } from '../../utils/syncMetadata'
import { buildDefaultCategories, buildDefaultPayees } from '../defaults'
import db from '../db/schema'
import { queueImportSyncMarker } from '../importService'
import { FULL_SYNC_QUEUE_REASON } from '../syncRuntime'

type BackupRow = Record<string, unknown>

function asBackupRows(value: unknown): BackupRow[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is BackupRow => typeof row === 'object' && row !== null)
}

function normalizeCategoryRows(rows: BackupRow[], now: string): Category[] {
  return rows.map((row) => {
    const normalized = normalizeImportedSyncMetadata(row, { now })
    const name = typeof row.name === 'string' ? row.name : ''

    return {
      ...row,
      ...normalized,
      name,
      normalizedName:
        typeof row.normalizedName === 'string' && row.normalizedName.length > 0
          ? row.normalizedName
          : normalizeNameForSync(name),
    } as Category
  })
}

function normalizePayeeRows(rows: BackupRow[], now: string): Payee[] {
  return rows.map((row) => {
    const normalized = normalizeImportedSyncMetadata(row, { now })
    const name = typeof row.name === 'string' ? row.name : ''

    return {
      ...row,
      ...normalized,
      name,
      normalizedName:
        typeof row.normalizedName === 'string' && row.normalizedName.length > 0
          ? row.normalizedName
          : normalizeNameForSync(name),
    } as Payee
  })
}

function normalizeExpenseRows(
  rows: BackupRow[],
  categories: Category[],
  payees: Payee[],
  now: string,
): Expense[] {
  const categoryNames = new Map(
    categories
      .filter((row) => typeof row.id === 'number')
      .map((row) => [row.id as number, row.name] as const),
  )
  const payeeNames = new Map(
    payees
      .filter((row) => typeof row.id === 'number')
      .map((row) => [row.id as number, row.name] as const),
  )

  return rows.map((row) => {
    const normalized = normalizeImportedSyncMetadata(row, { now })
    const categoryNameSnapshot =
      typeof row.categoryNameSnapshot === 'string' && row.categoryNameSnapshot.length > 0
        ? row.categoryNameSnapshot
        : typeof row.categoryId === 'number'
          ? (categoryNames.get(row.categoryId) ?? null)
          : null
    const payeeNameSnapshot =
      typeof row.payeeNameSnapshot === 'string' && row.payeeNameSnapshot.length > 0
        ? row.payeeNameSnapshot
        : typeof row.payeeId === 'number'
          ? (payeeNames.get(row.payeeId) ?? null)
          : null

    return {
      ...row,
      ...normalized,
      categoryNameSnapshot,
      payeeNameSnapshot,
    } as Expense
  })
}

function normalizeBackupPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const now = new Date().toISOString()
  const categories = normalizeCategoryRows(asBackupRows(payload.categories), now)
  const payees = normalizePayeeRows(asBackupRows(payload.payees), now)

  return {
    ...payload,
    expenses: normalizeExpenseRows(asBackupRows(payload.expenses), categories, payees, now),
    categories,
    payees,
    fixedExpenses: asBackupRows(payload.fixedExpenses).map(
      (row) =>
        ({ ...row, ...normalizeImportedSyncMetadata(row, { now }) }) as unknown as FixedExpense,
    ),
    expenseSplits: asBackupRows(payload.expenseSplits).map(
      (row) =>
        ({ ...row, ...normalizeImportedSyncMetadata(row, { now }) }) as unknown as ExpenseSplit,
    ),
    fixedExpenseSnapshots: asBackupRows(payload.fixedExpenseSnapshots).map(
      (row) =>
        ({
          ...row,
          ...normalizeImportedSyncMetadata(row, { now }),
        }) as unknown as FixedExpenseSnapshot,
    ),
    incomeSnapshots: asBackupRows(payload.incomeSnapshots).map(
      (row) =>
        ({ ...row, ...normalizeImportedSyncMetadata(row, { now }) }) as unknown as IncomeSnapshot,
    ),
    savingsSnapshots: asBackupRows(payload.savingsSnapshots).map(
      (row) =>
        ({ ...row, ...normalizeImportedSyncMetadata(row, { now }) }) as unknown as SavingsSnapshot,
    ),
    schedules: asBackupRows(payload.schedules).map(
      (row) => ({ ...row, ...normalizeImportedSyncMetadata(row, { now }) }) as unknown as Schedule,
    ),
    settings: asBackupRows(payload.settings).map(
      (row) => ({ ...row, ...normalizeImportedSyncMetadata(row, { now }) }) as unknown as Setting,
    ),
    categoryMergeHistory: asBackupRows(payload.categoryMergeHistory).map(
      (row) =>
        ({
          ...row,
          ...normalizeImportedSyncMetadata(row, { now }),
        }) as unknown as CategoryMergeHistory,
    ),
    payeeMergeHistory: asBackupRows(payload.payeeMergeHistory).map(
      (row) =>
        ({
          ...row,
          ...normalizeImportedSyncMetadata(row, { now }),
        }) as unknown as PayeeMergeHistory,
    ),
  }
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
    }
    const now = new Date().toISOString()
    await db.table('categories').bulkAdd(buildDefaultCategories(now))
    await db.table('payees').bulkAdd(buildDefaultPayees(now))
  })
}

export function dbVersion(): number {
  return db.verno
}

export async function exportAllData(): Promise<Record<string, unknown>> {
  return {
    expenses: await db.expenses.toArray(),
    categories: await db.categories.toArray(),
    payees: await db.payees.toArray(),
    fixedExpenses: await db.fixedExpenses.toArray(),
    expenseSplits: await db.expenseSplits.toArray(),
    fixedExpenseSnapshots: await db.fixedExpenseSnapshots.toArray(),
    incomeSnapshots: await db.incomeSnapshots.toArray(),
    savingsSnapshots: await db.savingsSnapshots.toArray(),
    schedules: await db.schedules.toArray(),
    settings: await db.settings.toArray(),
    syncQueue: await db.syncQueue.toArray(),
    categoryMergeHistory: await db.categoryMergeHistory.toArray(),
    payeeMergeHistory: await db.payeeMergeHistory.toArray(),
  }
}

export async function importBackup(
  data: Record<string, unknown>,
  password: string | null,
  { replace = false, queueFullSync = false } = {},
): Promise<void> {
  if (isEncryptedEnvelope(data)) {
    if (!password) {
      throw new Error('This backup is encrypted. Please enter the password.')
    }
    const decrypted = await decryptBackup(data, password)
    return importAllData(decrypted, { replace, queueFullSync })
  }
  return importAllData(data, { replace, queueFullSync })
}

export function bulkUpsertExpenses(rows: Expense[]): Promise<number> {
  return db.expenses.bulkPut(rows)
}

export function bulkUpsertCategories(rows: Category[]): Promise<number> {
  return db.categories.bulkPut(rows)
}

export function bulkUpsertPayees(rows: Payee[]): Promise<number> {
  return db.payees.bulkPut(rows)
}

export function bulkUpsertFixedExpenses(rows: FixedExpense[]): Promise<number> {
  return db.fixedExpenses.bulkPut(rows)
}

export function bulkUpsertExpenseSplits(rows: ExpenseSplit[]): Promise<number> {
  return db.expenseSplits.bulkPut(rows)
}

export async function importAllData(
  data: Record<string, unknown>,
  { replace = false, queueFullSync = false } = {},
): Promise<void> {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data')
  }

  // Support new { meta, data } format and old flat format
  const payload =
    'data' in data && typeof data.data === 'object' && data.data !== null
      ? (data.data as Record<string, unknown>)
      : data
  const normalizedPayload = normalizeBackupPayload(payload)

  await db.transaction('rw', db.tables, async () => {
    if (replace) {
      for (const table of db.tables) {
        await table.clear()
      }
    }

    if (normalizedPayload.expenses)
      await db.expenses.bulkPut(normalizedPayload.expenses as Expense[])
    if (normalizedPayload.categories) {
      await db.categories.bulkPut(normalizedPayload.categories as Category[])
    }
    if (normalizedPayload.payees) await db.payees.bulkPut(normalizedPayload.payees as Payee[])
    if (normalizedPayload.fixedExpenses) {
      await db.fixedExpenses.bulkPut(normalizedPayload.fixedExpenses as FixedExpense[])
    }
    if (normalizedPayload.expenseSplits) {
      await db.expenseSplits.bulkPut(normalizedPayload.expenseSplits as ExpenseSplit[])
    }
    if (normalizedPayload.fixedExpenseSnapshots) {
      await db.fixedExpenseSnapshots.bulkPut(
        normalizedPayload.fixedExpenseSnapshots as FixedExpenseSnapshot[],
      )
    }
    if (normalizedPayload.incomeSnapshots) {
      await db.incomeSnapshots.bulkPut(normalizedPayload.incomeSnapshots as IncomeSnapshot[])
    }
    if (normalizedPayload.savingsSnapshots) {
      await db.savingsSnapshots.bulkPut(normalizedPayload.savingsSnapshots as SavingsSnapshot[])
    }
    if (normalizedPayload.schedules) {
      await db.schedules.bulkPut(normalizedPayload.schedules as Schedule[])
    }
    if (normalizedPayload.settings) {
      await db.settings.bulkPut(normalizedPayload.settings as Setting[])
    }
    if (normalizedPayload.categoryMergeHistory) {
      await db.categoryMergeHistory.bulkPut(
        normalizedPayload.categoryMergeHistory as CategoryMergeHistory[],
      )
    }
    if (normalizedPayload.payeeMergeHistory) {
      await db.payeeMergeHistory.bulkPut(normalizedPayload.payeeMergeHistory as PayeeMergeHistory[])
    }

    if (!queueFullSync && normalizedPayload.syncQueue) {
      await db.syncQueue.bulkPut(normalizedPayload.syncQueue as SyncQueueItem[])
    }
  })

  if (queueFullSync) {
    await queueImportSyncMarker(
      { reason: FULL_SYNC_QUEUE_REASON, replace },
      { preserveDeletesOnly: true },
    )
  }
}
