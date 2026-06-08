import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStartupSnapshots } from '@/hooks/useStartupSnapshots'

const { materializePendingSnapshots, rolloverSnapshots, withTimeout } = vi.hoisted(() => ({
  materializePendingSnapshots: vi.fn(),
  rolloverSnapshots: vi.fn(),
  withTimeout: vi.fn(),
}))

vi.mock('@/services/repositories/scheduleRepository', () => ({
  materializePendingSnapshots,
  rolloverSnapshots,
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
    expect(withTimeout).toHaveBeenCalledTimes(2)
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
