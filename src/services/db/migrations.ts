import type { Category, Expense, Payee } from '../../types'

type MigrationTableRow = Record<string, unknown>

interface MigrationTable {
  toArray(): Promise<MigrationTableRow[]>
  update(id: number, changes: Record<string, unknown>): Promise<unknown>
}

interface MigrationTx {
  table(name: string): MigrationTable
}

function toLower(value: unknown): string {
  return String(value).toLowerCase()
}

export async function migrateV10CategoryPayeeIds(tx: MigrationTx): Promise<void> {
  // Migrate expense category/payee strings to IDs.
  const expenses = (await tx.table('expenses').toArray()) as unknown as Expense[]
  const categories = (await tx.table('categories').toArray()) as unknown as Category[]
  const payees = (await tx.table('payees').toArray()) as unknown as Payee[]
  const schedules = await tx.table('schedules').toArray()

  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
  const payeeByName = new Map(payees.map((p) => [p.name.toLowerCase(), p.id]))

  for (const exp of expenses) {
    const updates: Partial<Expense> = {}
    const expRow = exp as unknown as Record<string, unknown>
    if (!exp.categoryId && expRow.category) {
      const catId = catByName.get(toLower(expRow.category))
      if (catId) updates.categoryId = catId
    }
    if (!exp.payeeId && expRow.payee) {
      const payeeId = payeeByName.get(toLower(expRow.payee))
      if (payeeId) updates.payeeId = payeeId
    }
    if (Object.keys(updates).length > 0) {
      await tx.table('expenses').update(exp.id as number, updates as Record<string, unknown>)
    }
  }

  // Convert schedule.category string to categoryId independently of expense rows.
  for (const schedule of schedules) {
    if (schedule.category && !schedule.categoryId) {
      const catId = catByName.get(toLower(schedule.category))
      if (catId) {
        await tx.table('schedules').update(schedule.id as number, { categoryId: catId })
      }
    }
  }
}

function readStringField(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0
}

function resolveLegacySplitNotes(row: Record<string, unknown>): string {
  const notes = readStringField(row, 'notes')
  if (isNonEmpty(notes)) return notes

  const legacyDescription = readStringField(row, 'description')
  const legacyNote = readStringField(row, 'note')

  if (isNonEmpty(legacyDescription) && isNonEmpty(legacyNote)) {
    return legacyDescription
  }
  if (isNonEmpty(legacyDescription)) return legacyDescription
  if (isNonEmpty(legacyNote)) return legacyNote
  return legacyDescription || legacyNote
}

export async function migrateV22NotesFields(tx: MigrationTx): Promise<void> {
  const expenseRows = await tx.table('expenses').toArray()
  for (const row of expenseRows) {
    const nextNotes = readStringField(row, 'notes') || readStringField(row, 'description')
    const updates: Record<string, unknown> = {
      notes: nextNotes,
    }
    if (Object.hasOwn(row, 'description')) {
      updates.description = undefined
    }
    await tx.table('expenses').update(row.id as number, updates)
  }

  const splitRows = await tx.table('expenseSplits').toArray()
  for (const row of splitRows) {
    const updates: Record<string, unknown> = {
      notes: resolveLegacySplitNotes(row),
    }
    if (Object.hasOwn(row, 'description')) {
      updates.description = undefined
    }
    if (Object.hasOwn(row, 'note')) {
      updates.note = undefined
    }
    await tx.table('expenseSplits').update(row.id as number, updates)
  }

  const scheduleRows = await tx.table('schedules').toArray()
  for (const row of scheduleRows) {
    const nextNotes = readStringField(row, 'notes') || readStringField(row, 'note')
    const updates: Record<string, unknown> = {
      notes: nextNotes,
    }
    if (Object.hasOwn(row, 'note')) {
      updates.note = undefined
    }
    await tx.table('schedules').update(row.id as number, updates)
  }
}
