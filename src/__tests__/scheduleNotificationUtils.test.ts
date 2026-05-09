import { describe, expect, it } from 'vitest'
import type { Schedule } from '../types'
import {
  buildScheduleMaterializationNotice,
  summarizeScheduleMaterializationNotices,
} from '../utils/scheduleNotificationUtils'

describe('scheduleNotificationUtils', () => {
  it('builds an income materialization notice', () => {
    const schedule: Schedule = {
      type: 'income',
      targetId: null,
      effectiveYear: 2026,
      effectiveMonth: 5,
      newValue: 6500,
      isActive: 1,
    }

    const notice = buildScheduleMaterializationNotice(schedule, {
      appliedAt: '2026-05-01T00:00:00.000Z',
      previousValue: 5000,
    })

    expect(notice.title).toBe('Income')
    expect(notice.summary).toContain('changed from')
    expect(notice.summary).toContain('May 2026')
  })

  it('builds a planned expense notice', () => {
    const schedule: Schedule = {
      type: 'expense',
      targetId: null,
      effectiveYear: 2026,
      effectiveMonth: 7,
      newValue: 120,
      isActive: 1,
      day: 15,
    }

    const notice = buildScheduleMaterializationNotice(schedule, {
      appliedAt: '2026-07-01T00:00:00.000Z',
      label: 'Annual fee',
    })

    expect(notice.summary).toContain('Annual fee')
    expect(notice.summary).toContain('Jul 15, 2026')
  })

  it('summarizes multiple notices', () => {
    expect(
      summarizeScheduleMaterializationNotices([
        {
          id: '1',
          type: 'income',
          title: 'Income',
          summary: 'Income updated.',
          effectiveYear: 2026,
          effectiveMonth: 5,
          effectiveLabel: 'May 2026',
          previousValue: 5000,
          newValue: 6500,
          appliedAt: '2026-05-01T00:00:00.000Z',
        },
        {
          id: '2',
          type: 'savingsRate',
          title: 'Savings rate',
          summary: 'Savings updated.',
          effectiveYear: 2026,
          effectiveMonth: 5,
          effectiveLabel: 'May 2026',
          previousValue: 20,
          newValue: 25,
          appliedAt: '2026-05-01T00:00:00.000Z',
        },
      ]),
    ).toBe('2 scheduled updates were applied.')
  })
})
