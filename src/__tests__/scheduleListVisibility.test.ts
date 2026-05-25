import { describe, expect, it } from 'vitest'
import { partitionSchedulesForList } from '../utils/scheduleListVisibility'
import type { Schedule } from '../types'

function makeSchedule(overrides: Partial<Schedule>): Schedule {
  return {
    id: 1,
    type: 'income',
    targetId: null,
    effectiveYear: 2026,
    effectiveMonth: 5,
    newValue: 5000,
    isActive: 1,
    ...overrides,
  }
}

describe('partitionSchedulesForList', () => {
  it('hides active schedules that have already materialized for the current or past month', () => {
    const now = new Date('2026-05-23T12:00:00.000Z')

    const result = partitionSchedulesForList(
      [
        makeSchedule({ id: 1, materializedAt: '2026-05' }),
        makeSchedule({ id: 2, effectiveMonth: 6 }),
        makeSchedule({ id: 3, type: 'expense', isActive: 0, day: 23, notes: 'Planned lunch' }),
      ],
      now,
    )

    expect(result.upcoming.map((schedule) => schedule.id)).toEqual([2])
    expect(result.archived.map((schedule) => schedule.id)).toEqual([3])
  })

  it('keeps due active schedules visible when they have not materialized yet', () => {
    const now = new Date('2026-05-23T12:00:00.000Z')

    const result = partitionSchedulesForList(
      [
        makeSchedule({ id: 1, effectiveMonth: 5, materializedAt: undefined }),
        makeSchedule({ id: 2, effectiveMonth: 5, materializedAt: null }),
      ],
      now,
    )

    expect(result.upcoming.map((schedule) => schedule.id)).toEqual([1, 2])
    expect(result.archived).toEqual([])
  })
})
