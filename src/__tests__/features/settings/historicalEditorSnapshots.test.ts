import { describe, expect, it } from 'vitest'
import { fixedSnapshotsToItems } from '@/features/settings/utils/historicalEditorSnapshots'
import type { FixedExpenseSnapshot } from '@/types'

function makeSnapshot(overrides: Partial<FixedExpenseSnapshot> = {}): FixedExpenseSnapshot {
  return {
    fixedExpenseId: 11,
    year: 2026,
    month: 1,
    amountSnapshot: 1200,
    nameSnapshot: 'Rent',
    ...overrides,
  }
}

describe('fixedSnapshotsToItems', () => {
  it('merges adjacent fixed snapshots with equivalent cent-precision amounts', () => {
    const result = fixedSnapshotsToItems([
      makeSnapshot({ month: 1, amountSnapshot: 1200 }),
      makeSnapshot({ month: 2, amountSnapshot: 1200.0000000001 }),
      makeSnapshot({ month: 3, amountSnapshot: 1200.004 }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'Rent',
      amount: 1200,
      startMonth: 1,
      endMonth: 3,
      existingFixedExpenseId: 11,
    })
  })

  it('keeps fixed snapshot name changes as separate rows', () => {
    const result = fixedSnapshotsToItems([
      makeSnapshot({ month: 1, amountSnapshot: 1200, nameSnapshot: 'Old Rent' }),
      makeSnapshot({ month: 2, amountSnapshot: 1200.0000000001, nameSnapshot: 'New Rent' }),
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ name: 'Old Rent', startMonth: 1, endMonth: 1 })
    expect(result[1]).toMatchObject({ name: 'New Rent', startMonth: 2, endMonth: 2 })
  })

  it('splits fixed snapshots when displayed amounts differ', () => {
    const result = fixedSnapshotsToItems([
      makeSnapshot({ month: 1, amountSnapshot: 1200 }),
      makeSnapshot({ month: 2, amountSnapshot: 1200.01 }),
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ amount: 1200, startMonth: 1, endMonth: 1 })
    expect(result[1]).toMatchObject({ amount: 1200.01, startMonth: 2, endMonth: 2 })
  })
})
