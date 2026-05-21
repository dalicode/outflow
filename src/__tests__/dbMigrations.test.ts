import { describe, expect, it } from 'vitest'
import { migrateV10CategoryPayeeIds } from '../services/db/migrations'

type Row = Record<string, unknown>

class FakeTable {
  constructor(private rows: Row[]) {}

  async toArray(): Promise<Row[]> {
    return this.rows
  }

  async update(id: number, changes: Record<string, unknown>): Promise<number> {
    const row = this.rows.find((r) => r.id === id)
    if (!row) return 0
    Object.assign(row, changes)
    return 1
  }
}

class FakeTx {
  private tables: Record<string, FakeTable>

  constructor(seed: Record<string, Row[]>) {
    this.tables = {
      expenses: new FakeTable(seed.expenses ?? []),
      categories: new FakeTable(seed.categories ?? []),
      payees: new FakeTable(seed.payees ?? []),
      schedules: new FakeTable(seed.schedules ?? []),
    }
  }

  table(name: string): FakeTable {
    const table = this.tables[name]
    if (!table) throw new Error(`Unknown table: ${name}`)
    return table
  }
}

describe('migrateV10CategoryPayeeIds', () => {
  it('migrates schedule category when schedules exist and expenses are empty', async () => {
    const tx = new FakeTx({
      expenses: [],
      categories: [{ id: 1, name: 'Food' }],
      payees: [],
      schedules: [{ id: 10, category: 'Food' }],
    })

    await migrateV10CategoryPayeeIds(tx)

    const schedules = await tx.table('schedules').toArray()
    expect(schedules[0].categoryId).toBe(1)
  })

  it('migrates legacy expense category and payee names to ids', async () => {
    const tx = new FakeTx({
      expenses: [{ id: 1, category: 'Food', payee: 'Cafe' }],
      categories: [{ id: 11, name: 'Food' }],
      payees: [{ id: 21, name: 'Cafe' }],
      schedules: [],
    })

    await migrateV10CategoryPayeeIds(tx)

    const expenses = await tx.table('expenses').toArray()
    expect(expenses[0].categoryId).toBe(11)
    expect(expenses[0].payeeId).toBe(21)
  })

  it('does not overwrite existing schedule categoryId', async () => {
    const tx = new FakeTx({
      expenses: [],
      categories: [{ id: 99, name: 'Food' }],
      payees: [],
      schedules: [{ id: 5, category: 'Food', categoryId: 44 }],
    })

    await migrateV10CategoryPayeeIds(tx)

    const schedules = await tx.table('schedules').toArray()
    expect(schedules[0].categoryId).toBe(44)
  })

  it('leaves schedule unchanged when legacy category has no category match', async () => {
    const tx = new FakeTx({
      expenses: [],
      categories: [{ id: 2, name: 'Transport' }],
      payees: [],
      schedules: [{ id: 7, category: 'Food' }],
    })

    await migrateV10CategoryPayeeIds(tx)

    const schedules = await tx.table('schedules').toArray()
    expect(schedules[0].categoryId).toBeUndefined()
  })
})
