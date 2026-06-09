import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStartupSnapshots } from '@/hooks/useStartupSnapshots'

const {
  hasActiveUnmaterializedDueSchedule,
  materializePendingSnapshots,
  rolloverSnapshots,
  withTimeout,
} = vi.hoisted(() => ({
  hasActiveUnmaterializedDueSchedule: vi.fn(),
  materializePendingSnapshots: vi.fn(),
  rolloverSnapshots: vi.fn(),
  withTimeout: vi.fn(),
}))

const { getSetting, setLocalSetting } = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setLocalSetting: vi.fn(),
}))

vi.mock('@/services/repositories/scheduleRepository', () => ({
  hasActiveUnmaterializedDueSchedule,
  materializePendingSnapshots,
  rolloverSnapshots,
}))

vi.mock('@/services/storageService', () => ({
  StorageService: {
    getSetting,
    setLocalSetting,
  },
}))

vi.mock('@/lib/withTimeout', () => ({
  withTimeout,
}))

describe('useStartupSnapshots', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    materializePendingSnapshots.mockResolvedValue([])
    rolloverSnapshots.mockResolvedValue(undefined)
    hasActiveUnmaterializedDueSchedule.mockResolvedValue(false)
    getSetting.mockResolvedValue(null)
    setLocalSetting.mockResolvedValue(undefined)
    withTimeout.mockImplementation((promise: Promise<unknown>) => promise)
  })

  afterEach(() => {
    consoleDebugSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('runs startup snapshot maintenance in the background on success', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()

    renderHook(() => useStartupSnapshots({ showToast, onSnapshotsUpdated }))

    await waitFor(() => {
      expect(onSnapshotsUpdated).toHaveBeenCalledTimes(1)
    })

    expect(showToast).not.toHaveBeenCalled()
    expect(materializePendingSnapshots).toHaveBeenCalledTimes(1)
    expect(rolloverSnapshots).toHaveBeenCalledTimes(1)
    expect(rolloverSnapshots.mock.invocationCallOrder[0]).toBeGreaterThan(
      materializePendingSnapshots.mock.invocationCallOrder[0],
    )
    expect(onSnapshotsUpdated.mock.invocationCallOrder[0]).toBeGreaterThan(
      rolloverSnapshots.mock.invocationCallOrder[0],
    )
    expect(withTimeout).toHaveBeenCalledTimes(3)
    expect(withTimeout).toHaveBeenNthCalledWith(
      1,
      expect.any(Promise),
      10_000,
      '[startup-snapshots] materializePendingSnapshots timed out',
    )
    expect(withTimeout).toHaveBeenNthCalledWith(
      2,
      expect.any(Promise),
      10_000,
      '[startup-snapshots] rolloverSnapshots timed out',
    )
    expect(withTimeout).toHaveBeenNthCalledWith(
      3,
      expect.any(Promise),
      10_000,
      '[startup-snapshots] lastSnapshotMaintenanceDayKey update timed out',
    )
    expect(setLocalSetting).toHaveBeenCalledWith(
      'lastSnapshotMaintenanceDayKey',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    )
  })

  it('skips same-day maintenance when there is no newly due schedule', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()
    const now = new Date()
    const localTodayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(now.getDate()).padStart(2, '0')}`
    getSetting.mockImplementation(async (key: string, fallback: unknown) => {
      if (key === 'lastSnapshotMaintenanceDayKey') return localTodayKey
      return fallback
    })

    renderHook(() => useStartupSnapshots({ showToast, onSnapshotsUpdated }))

    await waitFor(() => {
      expect(hasActiveUnmaterializedDueSchedule).toHaveBeenCalledTimes(1)
    })

    expect(materializePendingSnapshots).not.toHaveBeenCalled()
    expect(rolloverSnapshots).not.toHaveBeenCalled()
    expect(onSnapshotsUpdated).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('runs same-day maintenance when an unmaterialized due schedule exists', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()
    getSetting.mockImplementation(async (key: string, fallback: unknown) => {
      if (key === 'lastSnapshotMaintenanceDayKey') return new Date().toISOString().slice(0, 10)
      return fallback
    })
    hasActiveUnmaterializedDueSchedule.mockResolvedValue(true)

    renderHook(() => useStartupSnapshots({ showToast, onSnapshotsUpdated }))

    await waitFor(() => {
      expect(onSnapshotsUpdated).toHaveBeenCalledTimes(1)
    })

    expect(materializePendingSnapshots).toHaveBeenCalledTimes(1)
    expect(rolloverSnapshots).toHaveBeenCalledTimes(1)
  })

  it('runs logged-out Supabase startup maintenance and marks reconcile pending', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()

    renderHook(() =>
      useStartupSnapshots({
        showToast,
        onSnapshotsUpdated,
        supabaseConfigured: true,
        isSignedIn: false,
        isOnline: true,
      }),
    )

    await waitFor(() => {
      expect(onSnapshotsUpdated).toHaveBeenCalledTimes(1)
    })

    expect(materializePendingSnapshots).toHaveBeenCalledTimes(1)
    expect(rolloverSnapshots).toHaveBeenCalledTimes(1)
    expect(setLocalSetting).toHaveBeenCalledWith('localOnlyMaintenancePendingReconcile', true)
    expect(setLocalSetting.mock.invocationCallOrder[0]).toBeGreaterThan(
      rolloverSnapshots.mock.invocationCallOrder[0],
    )
  })

  it('runs no-Supabase startup maintenance without marking reconcile pending', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()

    renderHook(() =>
      useStartupSnapshots({
        showToast,
        onSnapshotsUpdated,
        supabaseConfigured: false,
        isSignedIn: false,
        isOnline: true,
      }),
    )

    await waitFor(() => {
      expect(onSnapshotsUpdated).toHaveBeenCalledTimes(1)
    })

    expect(materializePendingSnapshots).toHaveBeenCalledTimes(1)
    expect(rolloverSnapshots).toHaveBeenCalledTimes(1)
    expect(setLocalSetting).not.toHaveBeenCalledWith(
      'localOnlyMaintenancePendingReconcile',
      true,
    )
  })

  it('marks reconcile pending for signed-in offline startup maintenance', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()

    renderHook(() =>
      useStartupSnapshots({
        showToast,
        onSnapshotsUpdated,
        supabaseConfigured: true,
        isSignedIn: true,
        isOnline: false,
      }),
    )

    await waitFor(() => {
      expect(onSnapshotsUpdated).toHaveBeenCalledTimes(1)
    })

    expect(setLocalSetting).toHaveBeenCalledWith('localOnlyMaintenancePendingReconcile', true)
  })

  it('waits for readyToStart before running background maintenance', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()
    const { rerender } = renderHook(
      ({ readyToStart }) => useStartupSnapshots({ showToast, readyToStart, onSnapshotsUpdated }),
      { initialProps: { readyToStart: false } },
    )

    expect(materializePendingSnapshots).not.toHaveBeenCalled()
    expect(onSnapshotsUpdated).not.toHaveBeenCalled()

    rerender({ readyToStart: true })

    await waitFor(() => {
      expect(onSnapshotsUpdated).toHaveBeenCalledTimes(1)
    })

    expect(materializePendingSnapshots).toHaveBeenCalledTimes(1)
    expect(rolloverSnapshots).toHaveBeenCalledTimes(1)
  })

  it('does not rerun maintenance after the startup pass has begun', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()
    const { rerender } = renderHook(
      ({ readyToStart }) => useStartupSnapshots({ showToast, readyToStart, onSnapshotsUpdated }),
      { initialProps: { readyToStart: true } },
    )

    await waitFor(() => {
      expect(onSnapshotsUpdated).toHaveBeenCalledTimes(1)
    })

    rerender({ readyToStart: false })
    rerender({ readyToStart: true })

    expect(materializePendingSnapshots).toHaveBeenCalledTimes(1)
    expect(rolloverSnapshots).toHaveBeenCalledTimes(1)
    expect(onSnapshotsUpdated).toHaveBeenCalledTimes(1)
  })

  it('warns when materializePendingSnapshots fails and does not run rollover or refresh', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()
    materializePendingSnapshots.mockRejectedValue(new Error('materialize failed'))

    renderHook(() => useStartupSnapshots({ showToast, onSnapshotsUpdated }))

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'warning',
        }),
      )
    })

    expect(rolloverSnapshots).not.toHaveBeenCalled()
    expect(onSnapshotsUpdated).not.toHaveBeenCalled()
  })

  it('warns when rolloverSnapshots fails and does not refresh', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()
    rolloverSnapshots.mockRejectedValue(new Error('rollover failed'))

    renderHook(() => useStartupSnapshots({ showToast, onSnapshotsUpdated }))

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'warning',
        }),
      )
    })

    expect(materializePendingSnapshots).toHaveBeenCalledTimes(1)
    expect(rolloverSnapshots).toHaveBeenCalledTimes(1)
    expect(onSnapshotsUpdated).not.toHaveBeenCalled()
  })

  it('skips rollover when materializePendingSnapshots times out and warns', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()
    withTimeout.mockRejectedValueOnce(new Error('materialize timeout'))

    renderHook(() => useStartupSnapshots({ showToast, onSnapshotsUpdated }))

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'warning',
        }),
      )
    })

    expect(rolloverSnapshots).not.toHaveBeenCalled()
    expect(onSnapshotsUpdated).not.toHaveBeenCalled()
  })

  it('preserves schedule-applied success toast while also warning on startup failure', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()
    materializePendingSnapshots.mockResolvedValue([
      {
        id: 'notice-1',
        type: 'income',
        title: 'Income updated',
        summary: 'Income changed',
        effectiveYear: 2026,
        effectiveMonth: 5,
        effectiveLabel: 'May 2026',
        previousValue: 6000,
        appliedAt: '2026-05-10T00:00:00.000Z',
        newValue: 6400,
      },
    ])
    withTimeout.mockImplementationOnce((promise: Promise<unknown>) => promise)
    withTimeout.mockRejectedValueOnce(new Error('rollover failed'))

    renderHook(() => useStartupSnapshots({ showToast, onSnapshotsUpdated }))

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledTimes(2)
    })

    expect(showToast).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tone: 'warning',
      }),
    )
    expect(showToast).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tone: 'success',
      }),
    )
    expect(onSnapshotsUpdated).not.toHaveBeenCalled()
  })

  it('preserves schedule-applied success toast after successful maintenance', async () => {
    const showToast = vi.fn()
    const onSnapshotsUpdated = vi.fn()
    materializePendingSnapshots.mockResolvedValue([
      {
        id: 'notice-1',
        type: 'income',
        title: 'Income updated',
        summary: 'Income changed',
        effectiveYear: 2026,
        effectiveMonth: 5,
        effectiveLabel: 'May 2026',
        previousValue: 6000,
        appliedAt: '2026-05-10T00:00:00.000Z',
        newValue: 6400,
      },
    ])

    renderHook(() => useStartupSnapshots({ showToast, onSnapshotsUpdated }))

    await waitFor(() => {
      expect(onSnapshotsUpdated).toHaveBeenCalledTimes(1)
    })

    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'success',
      }),
    )
  })
})
