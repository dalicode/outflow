import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Schedule } from '../types'

const {
  transactionSpy,
  settingsGetSpy,
  settingsPutSpy,
  schedulesUpdateSpy,
  schedulesGetSpy,
  syncQueueAddSpy,
  schedulesTable,
} = vi.hoisted(() => {
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
    },
  ]

  const localSchedulesUpdateSpy = vi.fn()
  const localSchedulesGetSpy = vi.fn()
  return {
    transactionSpy: vi.fn(),
    settingsGetSpy: vi.fn(),
    settingsPutSpy: vi.fn(),
    schedulesUpdateSpy: localSchedulesUpdateSpy,
    schedulesGetSpy: localSchedulesGetSpy,
    syncQueueAddSpy: vi.fn(),
    schedulesTable: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue(localSchedules),
        })),
      })),
      update: localSchedulesUpdateSpy,
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
    syncQueue: {
      add: syncQueueAddSpy,
    },
  }

  transactionSpy.mockImplementation(
    async (_mode: string, _tables: unknown[], callback: () => Promise<void>) => callback(),
  )
  schedulesUpdateSpy.mockResolvedValue(1)
  schedulesGetSpy.mockResolvedValue({
    id: 101,
    type: 'income',
    targetId: null,
    effectiveYear: 2026,
    effectiveMonth: 4,
    newValue: 7000,
    previousValue: 6500,
    isActive: 0,
  })
  syncQueueAddSpy.mockResolvedValue(1)
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
    const hasSchedulesTable = tables.some((table) => table === schedulesTable)
    expect(hasSchedulesTable).toBe(true)

    expect(schedulesUpdateSpy).toHaveBeenCalledWith(101, { isActive: 0 })
    expect(settingsPutSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'lastAppOpenMonthKey',
        value: '2026-05',
      }),
    )
  })
})
