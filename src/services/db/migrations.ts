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
