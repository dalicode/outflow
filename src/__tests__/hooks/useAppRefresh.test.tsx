import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppRefresh } from '@/hooks/useAppRefresh'

const { checkForServiceWorkerUpdateMock } = vi.hoisted(() => ({
  checkForServiceWorkerUpdateMock: vi.fn(),
}))

const {
  hasActiveUnmaterializedDueScheduleMock,
  materializePendingSnapshotsMock,
  rolloverSnapshotsMock,
} = vi.hoisted(() => ({
  hasActiveUnmaterializedDueScheduleMock: vi.fn(),
  materializePendingSnapshotsMock: vi.fn(),
  rolloverSnapshotsMock: vi.fn(),
}))

const { getSettingMock, setLocalSettingMock } = vi.hoisted(() => ({
  getSettingMock: vi.fn(),
  setLocalSettingMock: vi.fn(),
}))

vi.mock('@/utils/serviceWorkerUpdates', () => ({
  checkForServiceWorkerUpdate: checkForServiceWorkerUpdateMock,
}))

vi.mock('@/services/repositories/scheduleRepository', () => ({
  hasActiveUnmaterializedDueSchedule: hasActiveUnmaterializedDueScheduleMock,
  materializePendingSnapshots: materializePendingSnapshotsMock,
  rolloverSnapshots: rolloverSnapshotsMock,
}))

vi.mock('@/services/storageService', () => ({
  StorageService: {
    getSetting: getSettingMock,
    setLocalSetting: setLocalSettingMock,
  },
}))

vi.mock('@/services/supabase', () => ({
  supabase: {},
}))

describe('useAppRefresh', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
    checkForServiceWorkerUpdateMock.mockResolvedValue({
      registration: null,
      updateFound: false,
    })
    hasActiveUnmaterializedDueScheduleMock.mockResolvedValue(false)
    materializePendingSnapshotsMock.mockResolvedValue([])
    rolloverSnapshotsMock.mockResolvedValue(undefined)
    getSettingMock.mockResolvedValue(false)
    setLocalSettingMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    consoleDebugSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('checks for a service worker update during pull refresh', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshTags = vi.fn().mockResolvedValue(undefined)
    const loadSettings = vi.fn().mockResolvedValue(undefined)
    const announceAppliedScheduleUpdates = vi.fn()
    const showToast = vi.fn()
    const syncNow = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useAppRefresh({
        pullAppliedCount: 0,
        refreshExpenses,
        refreshCategories,
        refreshPayees,
        refreshTags,
        loadSettings,
        announceAppliedScheduleUpdates,
        showToast,
        syncNow,
        user: null,
      }),
    )

    await result.current.handlePullRefresh()

    expect(checkForServiceWorkerUpdateMock).toHaveBeenCalledTimes(1)
    expect(refreshExpenses).toHaveBeenCalledTimes(1)
    expect(refreshCategories).toHaveBeenCalledTimes(1)
    expect(refreshPayees).toHaveBeenCalledTimes(1)
    expect(refreshTags).toHaveBeenCalledTimes(1)
    expect(loadSettings).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith({
      message: 'Updated',
      tone: 'success',
      durationMs: 2500,
    })
  })

  it('runs manual pull refresh in pull, local refresh, materialize, rollover, finance order', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshTags = vi.fn().mockResolvedValue(undefined)
    const loadSettings = vi.fn().mockResolvedValue(undefined)
    const announceAppliedScheduleUpdates = vi.fn()
    const showToast = vi.fn()
    const syncNow = vi.fn().mockResolvedValue(undefined)
    const forceFinanceDataRefresh = vi.fn()

    const { result } = renderHook(() =>
      useAppRefresh({
        pullAppliedCount: 0,
        refreshExpenses,
        refreshCategories,
        refreshPayees,
        refreshTags,
        loadSettings,
        announceAppliedScheduleUpdates,
        showToast,
        syncNow,
        user: { id: 'user-1' },
        forceFinanceDataRefresh,
      }),
    )

    await result.current.handlePullRefresh()

    const syncOrder = syncNow.mock.invocationCallOrder[0]
    const localRefreshOrders = [
      refreshExpenses.mock.invocationCallOrder[0],
      refreshCategories.mock.invocationCallOrder[0],
      refreshPayees.mock.invocationCallOrder[0],
      refreshTags.mock.invocationCallOrder[0],
      loadSettings.mock.invocationCallOrder[0],
    ]
    const materializeOrder = materializePendingSnapshotsMock.mock.invocationCallOrder[0]
    const rolloverOrder = rolloverSnapshotsMock.mock.invocationCallOrder[0]
    const financeOrder = forceFinanceDataRefresh.mock.invocationCallOrder[0]

    expect(Math.max(...localRefreshOrders)).toBeGreaterThan(syncOrder)
    expect(materializeOrder).toBeGreaterThan(Math.max(...localRefreshOrders))
    expect(rolloverOrder).toBeGreaterThan(materializeOrder)
    expect(financeOrder).toBeGreaterThan(rolloverOrder)
    expect(announceAppliedScheduleUpdates).toHaveBeenCalledWith([])
    expect(showToast).toHaveBeenCalledWith({
      message: 'Updated',
      tone: 'success',
      durationMs: 2500,
    })
  })

  it('refreshes local readers and runs maintenance when pullAppliedCount increments', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshTags = vi.fn().mockResolvedValue(undefined)
    const loadSettings = vi.fn().mockResolvedValue(undefined)
    const announceAppliedScheduleUpdates = vi.fn()
    const showToast = vi.fn()
    const forceFinanceDataRefresh = vi.fn()

    const { rerender } = renderHook(
      ({ pullAppliedCount }: { pullAppliedCount: number }) =>
        useAppRefresh({
          pullAppliedCount,
          refreshExpenses,
          refreshCategories,
          refreshPayees,
          refreshTags,
          loadSettings,
          announceAppliedScheduleUpdates,
          showToast,
          syncNow: vi.fn(),
          user: null,
          forceFinanceDataRefresh,
        }),
      { initialProps: { pullAppliedCount: 0 } },
    )

    expect(refreshExpenses).not.toHaveBeenCalled()
    expect(refreshCategories).not.toHaveBeenCalled()
    expect(refreshPayees).not.toHaveBeenCalled()
    expect(refreshTags).not.toHaveBeenCalled()
    expect(loadSettings).not.toHaveBeenCalled()

    rerender({ pullAppliedCount: 1 })

    await waitFor(() => {
      expect(refreshExpenses).toHaveBeenCalledTimes(1)
      expect(refreshCategories).toHaveBeenCalledTimes(1)
      expect(refreshPayees).toHaveBeenCalledTimes(1)
      expect(refreshTags).toHaveBeenCalledTimes(1)
      expect(loadSettings).toHaveBeenCalledTimes(1)
      expect(forceFinanceDataRefresh).toHaveBeenCalledTimes(1)
    })

    const localRefreshOrders = [
      refreshExpenses.mock.invocationCallOrder[0],
      refreshCategories.mock.invocationCallOrder[0],
      refreshPayees.mock.invocationCallOrder[0],
      refreshTags.mock.invocationCallOrder[0],
      loadSettings.mock.invocationCallOrder[0],
    ]
    const materializeOrder = materializePendingSnapshotsMock.mock.invocationCallOrder[0]
    const rolloverOrder = rolloverSnapshotsMock.mock.invocationCallOrder[0]
    const financeOrder = forceFinanceDataRefresh.mock.invocationCallOrder[0]

    expect(materializeOrder).toBeGreaterThan(Math.max(...localRefreshOrders))
    expect(rolloverOrder).toBeGreaterThan(materializeOrder)
    expect(financeOrder).toBeGreaterThan(rolloverOrder)
    expect(announceAppliedScheduleUpdates).toHaveBeenCalledWith([])
    expect(showToast).not.toHaveBeenCalled()
  })

  it('clears reconcile flag after pull-applied local refresh and successful maintenance', async () => {
    getSettingMock.mockResolvedValue(true)
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshTags = vi.fn().mockResolvedValue(undefined)
    const loadSettings = vi.fn().mockResolvedValue(undefined)
    const announceAppliedScheduleUpdates = vi.fn()
    const showToast = vi.fn()
    const forceFinanceDataRefresh = vi.fn()

    const { rerender } = renderHook(
      ({ pullAppliedCount }: { pullAppliedCount: number }) =>
        useAppRefresh({
          pullAppliedCount,
          refreshExpenses,
          refreshCategories,
          refreshPayees,
          refreshTags,
          loadSettings,
          announceAppliedScheduleUpdates,
          showToast,
          syncNow: vi.fn(),
          user: { id: 'user-1' },
          forceFinanceDataRefresh,
        }),
      { initialProps: { pullAppliedCount: 0 } },
    )

    rerender({ pullAppliedCount: 1 })

    await waitFor(() => {
      expect(setLocalSettingMock).toHaveBeenCalledWith(
        'localOnlyMaintenancePendingReconcile',
        false,
      )
      expect(forceFinanceDataRefresh).toHaveBeenCalledTimes(1)
    })

    const localRefreshOrders = [
      refreshExpenses.mock.invocationCallOrder[0],
      refreshCategories.mock.invocationCallOrder[0],
      refreshPayees.mock.invocationCallOrder[0],
      refreshTags.mock.invocationCallOrder[0],
      loadSettings.mock.invocationCallOrder[0],
    ]
    const materializeOrder = materializePendingSnapshotsMock.mock.invocationCallOrder[0]
    const rolloverOrder = rolloverSnapshotsMock.mock.invocationCallOrder[0]
    const clearCallIndex = setLocalSettingMock.mock.calls.findIndex(
      ([key, value]) => key === 'localOnlyMaintenancePendingReconcile' && value === false,
    )
    const clearOrder = setLocalSettingMock.mock.invocationCallOrder[clearCallIndex]
    const financeOrder = forceFinanceDataRefresh.mock.invocationCallOrder[0]

    expect(materializeOrder).toBeGreaterThan(Math.max(...localRefreshOrders))
    expect(rolloverOrder).toBeGreaterThan(materializeOrder)
    expect(clearOrder).toBeGreaterThan(rolloverOrder)
    expect(financeOrder).toBeGreaterThan(clearOrder)
  })

  it('does not clear reconcile flag when pull-applied maintenance fails', async () => {
    getSettingMock.mockResolvedValue(true)
    materializePendingSnapshotsMock.mockRejectedValue(new Error('materialize failed'))
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshTags = vi.fn().mockResolvedValue(undefined)
    const loadSettings = vi.fn().mockResolvedValue(undefined)
    const announceAppliedScheduleUpdates = vi.fn()
    const showToast = vi.fn()
    const forceFinanceDataRefresh = vi.fn()

    const { rerender } = renderHook(
      ({ pullAppliedCount }: { pullAppliedCount: number }) =>
        useAppRefresh({
          pullAppliedCount,
          refreshExpenses,
          refreshCategories,
          refreshPayees,
          refreshTags,
          loadSettings,
          announceAppliedScheduleUpdates,
          showToast,
          syncNow: vi.fn(),
          user: { id: 'user-1' },
          forceFinanceDataRefresh,
        }),
      { initialProps: { pullAppliedCount: 0 } },
    )

    rerender({ pullAppliedCount: 1 })

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'warning',
        }),
      )
    })

    expect(setLocalSettingMock).not.toHaveBeenCalled()
    expect(forceFinanceDataRefresh).not.toHaveBeenCalled()
  })

  it('preserves schedule-applied notices after pull-applied maintenance without a generic success toast', async () => {
    const notice = {
      id: 'notice-1',
      type: 'income' as const,
      title: 'Income updated',
      summary: 'Income changed',
      effectiveYear: 2026,
      effectiveMonth: 5,
      effectiveLabel: 'May 2026',
      previousValue: 6000,
      appliedAt: '2026-05-10T00:00:00.000Z',
      newValue: 6400,
    }
    materializePendingSnapshotsMock.mockResolvedValue([notice])
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshTags = vi.fn().mockResolvedValue(undefined)
    const loadSettings = vi.fn().mockResolvedValue(undefined)
    const announceAppliedScheduleUpdates = vi.fn()
    const showToast = vi.fn()

    const { rerender } = renderHook(
      ({ pullAppliedCount }: { pullAppliedCount: number }) =>
        useAppRefresh({
          pullAppliedCount,
          refreshExpenses,
          refreshCategories,
          refreshPayees,
          refreshTags,
          loadSettings,
          announceAppliedScheduleUpdates,
          showToast,
          syncNow: vi.fn(),
          user: { id: 'user-1' },
        }),
      { initialProps: { pullAppliedCount: 0 } },
    )

    rerender({ pullAppliedCount: 1 })

    await waitFor(() => {
      expect(announceAppliedScheduleUpdates).toHaveBeenCalledWith([notice])
    })

    expect(showToast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Updated',
        tone: 'success',
      }),
    )
  })

  it('skips local refresh work on same-day focus when no due schedule exists', async () => {
    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(today.getDate()).padStart(2, '0')}`
    getSettingMock.mockImplementation(async (key: string, fallback: unknown) => {
      if (key === 'lastSnapshotMaintenanceDayKey') return todayKey
      return fallback
    })
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshTags = vi.fn().mockResolvedValue(undefined)
    const loadSettings = vi.fn().mockResolvedValue(undefined)
    const announceAppliedScheduleUpdates = vi.fn()
    const showToast = vi.fn()
    const forceFinanceDataRefresh = vi.fn()

    renderHook(() =>
      useAppRefresh({
        pullAppliedCount: 0,
        refreshExpenses,
        refreshCategories,
        refreshPayees,
        refreshTags,
        loadSettings,
        announceAppliedScheduleUpdates,
        showToast,
        syncNow: vi.fn(),
        user: null,
        forceFinanceDataRefresh,
      }),
    )

    window.dispatchEvent(new Event('focus'))

    await waitFor(() => {
      expect(hasActiveUnmaterializedDueScheduleMock).toHaveBeenCalledTimes(1)
    })

    expect(materializePendingSnapshotsMock).not.toHaveBeenCalled()
    expect(rolloverSnapshotsMock).not.toHaveBeenCalled()
    expect(refreshExpenses).not.toHaveBeenCalled()
    expect(refreshCategories).not.toHaveBeenCalled()
    expect(refreshPayees).not.toHaveBeenCalled()
    expect(refreshTags).not.toHaveBeenCalled()
    expect(loadSettings).not.toHaveBeenCalled()
    expect(forceFinanceDataRefresh).not.toHaveBeenCalled()
  })
})
