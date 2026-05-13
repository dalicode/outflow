import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncController } from '../hooks/useSyncController'

const {
  getSyncQueue,
  flushSyncQueue,
  pullFromSupabase,
  migrateLocalToSupabase,
  isSyncPaused,
} = vi.hoisted(() => ({
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

  it('flushes local changes even when the last sync was recent', async () => {
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
    expect(flushSyncQueue).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.triggerSync()
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(flushSyncQueue).toHaveBeenCalledTimes(2)
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

  it('runs an immediate pull when the app comes back online even if sync was recent', async () => {
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
  })

  it('periodically pulls while the tab stays visible', async () => {
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    expect(pullFromSupabase).toHaveBeenCalledTimes(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)
  })
})
