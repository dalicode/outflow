import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Schedule } from '../types'

const { transactionSpy, settingsGetSpy, settingsPutSpy, schedulesPutSpy, schedulesTable } =
  vi.hoisted(() => {
    const localSchedules: Schedule[] = [
      {
        id: 101,
        type: 'income',
        targetId: null,
        effectiveYear: 2026,
        effectiveMonth: 4,
        newValue: 7000,
        previousValue: 6500,
        isActive: 1,
        localId: 'schedule-101',
        syncStatus: 'synced',
        deletedAt: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        lastSyncedAt: '2026-04-01T00:00:00.000Z',
        syncError: null,
        deviceId: 'device-1',
      },
    ]

    const localSchedulesPutSpy = vi.fn(async (row: Schedule) => row.id ?? 101)
    const localSchedulesGetSpy = vi.fn(async (id: number) =>
      localSchedules.find((row) => row.id === id),
    )

    return {
      transactionSpy: vi.fn(),
      settingsGetSpy: vi.fn(),
      settingsPutSpy: vi.fn(),
      schedulesPutSpy: localSchedulesPutSpy,
      schedulesGetSpy: localSchedulesGetSpy,
      schedulesTable: {
        toArray: vi.fn(async () => localSchedules),
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            toArray: vi.fn(async () => localSchedules),
          })),
        })),
        put: localSchedulesPutSpy,
        get: localSchedulesGetSpy,
      },
    }
  })

vi.mock('../services/db/schema', () => {
  const db = {
    transaction: transactionSpy,
    fixedExpenses: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    incomeSnapshots: {
      toArray: vi.fn().mockResolvedValue([]),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    savingsSnapshots: {
      toArray: vi.fn().mockResolvedValue([]),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    fixedExpenseSnapshots: {
      toArray: vi.fn().mockResolvedValue([]),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    settings: {
      get: settingsGetSpy,
      put: settingsPutSpy,
    },
    schedules: schedulesTable,
  }

  transactionSpy.mockImplementation(
    async (_mode: string, _tables: unknown[], callback: () => Promise<void>) => callback(),
  )
  settingsPutSpy.mockResolvedValue('lastAppOpenMonthKey')

  return {
    default: db,
  }
})

import { rolloverSnapshots } from '../services/repositories/scheduleRepository'

describe('rolloverSnapshots transaction tables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'))
    settingsGetSpy.mockImplementation(async (key: string) => {
      if (key === 'lastAppOpenMonthKey') return { key, value: '2026-04' }
      if (key === 'monthlyIncome') return { key, value: 6500 }
      if (key === 'savingsRate') return { key, value: 20 }
      return undefined
    })
    transactionSpy.mockImplementation(
      async (_mode: string, _tables: unknown[], callback: () => Promise<void>) => callback(),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('includes schedules in transaction and archives due schedules while updating open month key', async () => {
    await rolloverSnapshots()

    expect(transactionSpy).toHaveBeenCalledTimes(1)
    const [_mode, tables] = transactionSpy.mock.calls[0] as [string, unknown[]]
    expect(Array.isArray(tables)).toBe(true)
    expect(tables).toContain(schedulesTable)

    expect(schedulesPutSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 101,
        isActive: 0,
      }),
    )
    expect(settingsPutSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'lastAppOpenMonthKey',
        value: '2026-05',
      }),
    )
  })
})
