import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStartupSnapshots } from '../hooks/useStartupSnapshots'

const { materializePendingSnapshots, rolloverSnapshots, withTimeout } = vi.hoisted(() => ({
  materializePendingSnapshots: vi.fn(),
  rolloverSnapshots: vi.fn(),
  withTimeout: vi.fn(),
}))

vi.mock('../services/repositories/scheduleRepository', () => ({
  materializePendingSnapshots,
  rolloverSnapshots,
}))

vi.mock('../lib/withTimeout', () => ({
  withTimeout,
}))

describe('useStartupSnapshots', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    localStorage.setItem('outflow:hasVisited', 'true')
    ;(window as unknown as { outflowTestApi?: unknown }).outflowTestApi = {}
    materializePendingSnapshots.mockResolvedValue([])
    rolloverSnapshots.mockResolvedValue(undefined)
    withTimeout.mockImplementation((promise: Promise<unknown>) => promise)
  })

  afterEach(() => {
    consoleDebugSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('sets snapshotsReady on startup success', async () => {
    const showToast = vi.fn()
    const { result } = renderHook(() => useStartupSnapshots({ showToast }))

    await waitFor(() => {
      expect(result.current.snapshotsReady).toBe(true)
    })

    expect(showToast).not.toHaveBeenCalled()
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

  it('still unlocks startup when materializePendingSnapshots fails', async () => {
    const showToast = vi.fn()
    materializePendingSnapshots.mockRejectedValue(new Error('materialize failed'))

    const { result } = renderHook(() => useStartupSnapshots({ showToast }))

    await waitFor(() => {
      expect(result.current.snapshotsReady).toBe(true)
    })

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'warning',
      }),
    )
  })

  it('still unlocks startup when rolloverSnapshots fails', async () => {
    const showToast = vi.fn()
    rolloverSnapshots.mockRejectedValue(new Error('rollover failed'))

    const { result } = renderHook(() => useStartupSnapshots({ showToast }))

    await waitFor(() => {
      expect(result.current.snapshotsReady).toBe(true)
    })

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'warning',
      }),
    )
  })

  it('still unlocks startup when materializePendingSnapshots times out', async () => {
    const showToast = vi.fn()
    withTimeout.mockRejectedValueOnce(new Error('timeout'))

    const { result } = renderHook(() => useStartupSnapshots({ showToast }))

    await waitFor(() => {
      expect(result.current.snapshotsReady).toBe(true)
    })

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'warning',
      }),
    )
  })

  it('does not remain blocked when both startup snapshot steps fail', async () => {
    const showToast = vi.fn()
    withTimeout.mockRejectedValue(new Error('startup stalled'))

    const { result } = renderHook(() => useStartupSnapshots({ showToast }))

    await waitFor(() => {
      expect(result.current.snapshotsReady).toBe(true)
    })

    expect(showToast).toHaveBeenCalledTimes(1)
  })

  it('preserves schedule-applied success toast while also warning on startup failure', async () => {
    const showToast = vi.fn()
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

    const { result } = renderHook(() => useStartupSnapshots({ showToast }))

    await waitFor(() => {
      expect(result.current.snapshotsReady).toBe(true)
    })

    expect(showToast).toHaveBeenCalledTimes(2)
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
  })
})
