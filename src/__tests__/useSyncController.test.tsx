import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncController } from '../hooks/useSyncController'

const { getSyncQueue, flushSyncQueue, pullFromSupabase, migrateLocalToSupabase, isSyncPaused } =
  vi.hoisted(() => ({
    getSyncQueue: vi.fn(),
    flushSyncQueue: vi.fn(),
    pullFromSupabase: vi.fn(),
    migrateLocalToSupabase: vi.fn(),
    isSyncPaused: vi.fn(),
  }))

vi.mock('../services/storageService', () => ({
  StorageService: {
    getSyncQueue,
  },
}))

vi.mock('../services/syncRuntime', () => ({
  isSyncPaused,
}))

vi.mock('../services/syncService', () => ({
  flushSyncQueue,
  migrateLocalToSupabase,
  pullFromSupabase,
}))

vi.mock('../utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}))

describe('useSyncController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    getSyncQueue.mockResolvedValue([{ id: 1 }])
    flushSyncQueue.mockResolvedValue(undefined)
    pullFromSupabase.mockResolvedValue(undefined)
    migrateLocalToSupabase.mockResolvedValue(undefined)
    isSyncPaused.mockReturnValue(false)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  it('syncNow flushes local changes before pulling remote rows', async () => {
    const callOrder: string[] = []
    flushSyncQueue.mockImplementation(async () => {
      callOrder.push('flush')
    })
    pullFromSupabase.mockImplementation(async () => {
      callOrder.push('pull')
    })
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      await result.current.syncNow()
    })

    expect(callOrder).toEqual(['flush', 'pull'])
  })

  it('syncLocalChanges only flushes queued local changes', async () => {
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      await result.current.syncLocalChanges()
    })

    expect(flushSyncQueue).toHaveBeenCalledTimes(1)
    expect(pullFromSupabase).not.toHaveBeenCalled()
  })

  it('promotes queued follow-up syncs to the stronger later request', async () => {
    let releasePull: (() => void) | null = null
    pullFromSupabase.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releasePull = resolve
        }),
    )

    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    let firstSyncPromise: Promise<void> | undefined

    await act(async () => {
      firstSyncPromise = result.current.queueSync({
        reason: 'local-change',
        mode: 'flush-only',
      })
      await Promise.resolve()
    })

    expect(flushSyncQueue).toHaveBeenCalledTimes(1)
    expect(pullFromSupabase).toHaveBeenCalledTimes(0)

    await act(async () => {
      void result.current.queueSync({
        reason: 'manual',
        mode: 'pull-and-flush',
        force: true,
      })
      await Promise.resolve()
    })

    await act(async () => {
      releasePull?.()
      await firstSyncPromise
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)
    expect(flushSyncQueue).toHaveBeenCalledTimes(2)
  })

  it('background freshness pulls first when there are no pending local changes', async () => {
    getSyncQueue.mockResolvedValue([])
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(2)
    expect(flushSyncQueue).toHaveBeenCalledTimes(0)
  })

  it('background freshness flushes before pull when local changes are pending', async () => {
    const callOrder: string[] = []
    flushSyncQueue.mockImplementation(async () => {
      callOrder.push('flush')
    })
    pullFromSupabase.mockImplementation(async () => {
      callOrder.push('pull')
    })

    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    expect(callOrder).toEqual(['flush', 'pull'])
  })

  it('suppresses focus and token-refresh pull bursts right after a successful sync', async () => {
    getSyncQueue.mockResolvedValue([])
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      await result.current.syncNow()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await result.current.queueSync({ reason: 'token-refresh', mode: 'pull-and-flush' })
      await Promise.resolve()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
      await result.current.queueSync({ reason: 'token-refresh', mode: 'pull-and-flush' })
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(2)
  })

  it('still allows online pulls immediately after a recent successful sync', async () => {
    getSyncQueue.mockResolvedValue([])
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      await result.current.syncNow()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(2)
  })

  it('flushes before pull when using syncLocalThenPull', async () => {
    const callOrder: string[] = []
    flushSyncQueue.mockImplementation(async () => {
      callOrder.push('flush')
    })
    pullFromSupabase.mockImplementation(async () => {
      callOrder.push('pull')
    })

    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      await result.current.syncLocalThenPull()
    })

    expect(callOrder).toEqual(['flush', 'pull'])
  })

  it('increments pullAppliedCount immediately after pull in full-upload-after-pull mode', async () => {
    let resolvePull: (() => void) | null = null
    let resolveMigrate: (() => void) | null = null
    pullFromSupabase.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePull = resolve
        }),
    )
    migrateLocalToSupabase.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMigrate = resolve
        }),
    )

    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    let syncPromise: Promise<void> | undefined
    await act(async () => {
      syncPromise = result.current.queueSync({
        reason: 'sign-in',
        mode: 'full-upload-after-pull',
        force: true,
      })
      await Promise.resolve()
    })

    expect(result.current.pullAppliedCount).toBe(0)
    expect(result.current.syncCount).toBe(0)

    await act(async () => {
      resolvePull?.()
      await Promise.resolve()
    })

    expect(result.current.pullAppliedCount).toBe(1)
    expect(result.current.syncCount).toBe(0)

    await act(async () => {
      resolveMigrate?.()
      await syncPromise
    })

    expect(result.current.syncCount).toBe(1)
  })

  it('does not increment pullAppliedCount for flush-only syncs', async () => {
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      await result.current.syncLocalChanges()
    })

    expect(result.current.pullAppliedCount).toBe(0)
    expect(result.current.syncCount).toBe(1)
  })
})
