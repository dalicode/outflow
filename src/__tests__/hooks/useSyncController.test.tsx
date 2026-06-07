import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncController } from '@/hooks/useSyncController'

const {
  hasPendingSyncMetadata,
  getSyncMetadataCounts,
  flushSyncQueue,
  pullFromSupabase,
  isSyncPaused,
} = vi.hoisted(() => ({
  hasPendingSyncMetadata: vi.fn(),
  getSyncMetadataCounts: vi.fn(),
  flushSyncQueue: vi.fn(),
  pullFromSupabase: vi.fn(),
  isSyncPaused: vi.fn(),
}))

vi.mock('@/services/storageService', () => ({
  StorageService: {
    hasPendingSyncMetadata,
    getSyncMetadataCounts,
  },
}))

vi.mock('@/services/syncRuntime', () => ({
  isSyncPaused,
}))

vi.mock('@/services/syncService', () => ({
  flushSyncQueue,
  pullFromSupabase,
}))

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}))

function setDocumentVisibility(visibilityState: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  })
}

describe('useSyncController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    hasPendingSyncMetadata.mockResolvedValue(false)
    getSyncMetadataCounts.mockResolvedValue({ pending: 0, failed: 0 })
    flushSyncQueue.mockResolvedValue(undefined)
    pullFromSupabase.mockResolvedValue(undefined)
    isSyncPaused.mockReturnValue(false)
    setDocumentVisibility('visible')
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  it('syncNow uploads local changes before pulling remote rows', async () => {
    const callOrder: string[] = []
    flushSyncQueue.mockImplementation(async () => {
      callOrder.push('upload')
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

    expect(callOrder).toEqual(['upload', 'pull'])
  })

  it('syncLocalChanges only uploads pending local changes', async () => {
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

  it('runs a pull-only follow-up when a pull request arrives during an active upload-only sync', async () => {
    let releaseUpload: (() => void) | null = null
    flushSyncQueue.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseUpload = resolve
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
        mode: 'upload-only',
      })
      await Promise.resolve()
    })

    expect(flushSyncQueue).toHaveBeenCalledTimes(1)
    expect(pullFromSupabase).toHaveBeenCalledTimes(0)

    await act(async () => {
      void result.current.queueSync({
        reason: 'manual',
        mode: 'pull-only',
        force: true,
      })
      await Promise.resolve()
    })

    await act(async () => {
      releaseUpload?.()
      await firstSyncPromise
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)
    expect(flushSyncQueue).toHaveBeenCalledTimes(1)
  })

  it('invalidation clears timers and prevents queued follow-up sync execution', async () => {
    let releaseUpload: (() => void) | null = null
    flushSyncQueue.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseUpload = resolve
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
        mode: 'upload-only',
      })
      await Promise.resolve()
    })

    await act(async () => {
      void result.current.queueSync({
        reason: 'manual',
        mode: 'pull-only',
        force: true,
      })
      await Promise.resolve()
      result.current.triggerSync()
      result.current.invalidateSyncRun()
      await vi.advanceTimersByTimeAsync(2_100)
    })

    await act(async () => {
      releaseUpload?.()
      await firstSyncPromise
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(0)
    expect(flushSyncQueue).toHaveBeenCalledTimes(1)

    pullFromSupabase.mockRejectedValueOnce(new Error('sync failed'))

    await act(async () => {
      await result.current.syncNow().catch(() => undefined)
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.invalidateSyncRun()
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)
  })

  it('does not continue to the success path after invalidating an in-flight sync', async () => {
    let releasePull: (() => void) | null = null
    pullFromSupabase.mockImplementationOnce(
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

    let syncPromise: Promise<void> | undefined
    await act(async () => {
      syncPromise = result.current.queueSync({
        reason: 'manual',
        mode: 'pull-only',
        force: true,
      })
      await Promise.resolve()
    })

    await act(async () => {
      result.current.invalidateSyncRun()
      await Promise.resolve()
    })

    await act(async () => {
      releasePull?.()
      await syncPromise
    })

    expect(result.current.pullAppliedCount).toBe(0)
    expect(result.current.syncCount).toBe(0)
    expect(result.current.hasSynced).toBe(false)
    expect(runRecoveryCheck).not.toHaveBeenCalled()
  })

  it('reports offline while syncing when the browser goes offline mid-run', async () => {
    let releaseUpload: (() => void) | null = null
    flushSyncQueue.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseUpload = resolve
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
      syncPromise = result.current.syncLocalChanges()
      await Promise.resolve()
    })

    expect(result.current.syncStatus).toBe('syncing')

    await act(async () => {
      window.dispatchEvent(new Event('offline'))
      await Promise.resolve()
    })

    expect(result.current.syncStatus).toBe('offline')

    await act(async () => {
      releaseUpload?.()
      await syncPromise
    })
  })

  it('allows a fresh sync run after invalidation', async () => {
    let releaseUpload: (() => void) | null = null
    flushSyncQueue.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseUpload = resolve
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
      firstSyncPromise = result.current.syncLocalChanges()
      await Promise.resolve()
    })

    await act(async () => {
      result.current.invalidateSyncRun()
      await Promise.resolve()
    })

    await act(async () => {
      releaseUpload?.()
      await firstSyncPromise
    })

    await act(async () => {
      await result.current.syncLocalChanges()
    })

    expect(flushSyncQueue).toHaveBeenCalledTimes(2)
    expect(result.current.syncCount).toBe(1)
    expect(runRecoveryCheck).toHaveBeenCalledTimes(1)
  })

  it('focus freshness performs a pull-only sync when there are no pending local changes', async () => {
    const callOrder: string[] = []
    pullFromSupabase.mockImplementation(async () => {
      callOrder.push('pull')
    })
    flushSyncQueue.mockImplementation(async () => {
      callOrder.push('flush')
    })
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)
    expect(flushSyncQueue).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(2)
    expect(flushSyncQueue).not.toHaveBeenCalled()
    expect(callOrder).toEqual(['pull', 'pull'])
  })

  it('pulls after a long hidden resume even when the normal freshness gate would suppress it', async () => {
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

    await act(async () => {
      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(15_000)
      await result.current.syncNow()
      await vi.advanceTimersByTimeAsync(15_000)
      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(3)
    expect(flushSyncQueue).toHaveBeenCalledTimes(2)
  })

  it('does not pull when the tab resumes before the hidden threshold', async () => {
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

    await act(async () => {
      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(29_999)
      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)
  })

  it('does not double-pull when focus fires right after a long hidden resume', async () => {
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

    await act(async () => {
      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(30_000)
      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(2)
  })

  it('uploads pending local changes before pulling after a long hidden resume', async () => {
    hasPendingSyncMetadata.mockResolvedValue(true)
    const callOrder: string[] = []
    flushSyncQueue.mockImplementation(async () => {
      callOrder.push('upload')
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
      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(30_000)
      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(callOrder).toEqual(['upload', 'pull'])
  })

  it('background freshness uploads before pulling when local changes are pending', async () => {
    hasPendingSyncMetadata.mockResolvedValue(true)
    const callOrder: string[] = []
    flushSyncQueue.mockImplementation(async () => {
      callOrder.push('upload')
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

    expect(callOrder).toEqual(['upload', 'pull'])
  })

  it('treats pending metadata rows as local changes even when queue is empty', async () => {
    hasPendingSyncMetadata.mockResolvedValue(true)
    const callOrder: string[] = []
    flushSyncQueue.mockImplementation(async () => {
      callOrder.push('upload')
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

    expect(callOrder).toEqual(['upload', 'pull'])
  })

  it('suppresses focus and token-refresh pull bursts right after a successful sync', async () => {
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
      await result.current.queueSync({ reason: 'token-refresh' })
      await Promise.resolve()
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
      await result.current.queueSync({ reason: 'token-refresh' })
    })

    expect(pullFromSupabase).toHaveBeenCalledTimes(2)
  })

  it('still allows online recovery uploads immediately after a recent successful sync', async () => {
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
    expect(flushSyncQueue).toHaveBeenCalledTimes(2)
  })

  it('uploads before pull when using syncLocalThenPull', async () => {
    const callOrder: string[] = []
    flushSyncQueue.mockImplementation(async () => {
      callOrder.push('upload')
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

    expect(callOrder).toEqual(['upload', 'pull'])
  })

  it('increments pullAppliedCount immediately after pull in full-repair mode', async () => {
    let resolvePull: (() => void) | null = null
    let resolveUpload: (() => void) | null = null
    pullFromSupabase.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePull = resolve
        }),
    )
    flushSyncQueue.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve
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
        mode: 'full-repair',
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
      resolveUpload?.()
      await syncPromise
    })

    expect(result.current.syncCount).toBe(1)
  })

  it('does not increment pullAppliedCount for upload-only syncs', async () => {
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

  it('keeps status idle when there are pending rows but no active run or failures', async () => {
    getSyncMetadataCounts.mockResolvedValue({ pending: 2, failed: 0 })
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.syncStatus).toBe('idle')
  })

  it('reports error when failed metadata exists', async () => {
    getSyncMetadataCounts.mockResolvedValue({ pending: 0, failed: 1 })
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.syncStatus).toBe('error')
  })

  it('reports offline when browser goes offline', async () => {
    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    await act(async () => {
      window.dispatchEvent(new Event('offline'))
      await Promise.resolve()
    })

    expect(result.current.syncStatus).toBe('offline')
  })

  it('reports syncing only while a sync run is active', async () => {
    let releaseUpload: (() => void) | null = null
    flushSyncQueue.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseUpload = resolve
        }),
    )
    getSyncMetadataCounts.mockResolvedValue({ pending: 3, failed: 0 })

    const runRecoveryCheck = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useSyncController({
        userId: 'user-1',
        runRecoveryCheck,
      }),
    )

    let syncPromise: Promise<void> | undefined
    await act(async () => {
      syncPromise = result.current.syncLocalChanges()
      await Promise.resolve()
    })

    expect(result.current.syncStatus).toBe('syncing')

    await act(async () => {
      releaseUpload?.()
      await syncPromise
    })

    expect(result.current.syncStatus).toBe('idle')
  })
})
