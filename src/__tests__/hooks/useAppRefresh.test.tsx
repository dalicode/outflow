import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppRefresh } from '@/hooks/useAppRefresh'

const { checkForServiceWorkerUpdateMock } = vi.hoisted(() => ({
  checkForServiceWorkerUpdateMock: vi.fn(),
}))

const { materializePendingSnapshotsMock, rolloverSnapshotsMock } = vi.hoisted(() => ({
  materializePendingSnapshotsMock: vi.fn(),
  rolloverSnapshotsMock: vi.fn(),
}))

vi.mock('@/utils/serviceWorkerUpdates', () => ({
  checkForServiceWorkerUpdate: checkForServiceWorkerUpdateMock,
}))

vi.mock('@/services/repositories/scheduleRepository', () => ({
  materializePendingSnapshots: materializePendingSnapshotsMock,
  rolloverSnapshots: rolloverSnapshotsMock,
}))

describe('useAppRefresh', () => {
  it('checks for a service worker update during pull refresh', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshTags = vi.fn().mockResolvedValue(undefined)
    const announceAppliedScheduleUpdates = vi.fn()
    const showToast = vi.fn()
    const syncNow = vi.fn().mockResolvedValue(undefined)

    checkForServiceWorkerUpdateMock.mockResolvedValue({
      registration: null,
      updateFound: false,
    })
    materializePendingSnapshotsMock.mockResolvedValue([])
    rolloverSnapshotsMock.mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useAppRefresh({
        pullAppliedCount: 0,
        refreshExpenses,
        refreshCategories,
        refreshPayees,
        refreshTags,
        loadSettings: vi.fn().mockResolvedValue(undefined),
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
    expect(showToast).toHaveBeenCalledWith({
      message: 'Updated',
      tone: 'success',
      durationMs: 2500,
    })
  })

  it('refreshes non-reactive readers when pullAppliedCount increments', async () => {
    materializePendingSnapshotsMock.mockReset()
    rolloverSnapshotsMock.mockReset()
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshTags = vi.fn().mockResolvedValue(undefined)
    const loadSettings = vi.fn().mockResolvedValue(undefined)
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
          announceAppliedScheduleUpdates: vi.fn(),
          showToast: vi.fn(),
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
  })
})
