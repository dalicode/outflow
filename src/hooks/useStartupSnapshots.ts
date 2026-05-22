import { useCallback, useEffect, useState } from 'react'
import { StorageService } from '../services/storageService'
import { summarizeScheduleMaterializationNotices } from '../utils/scheduleNotificationUtils'
import { withTimeout } from '../utils/withTimeout'

interface UseStartupSnapshotsParams {
  showToast: (toast: {
    message: string
    tone: 'success' | 'warning' | 'danger' | 'default'
    durationMs?: number
  }) => string
}

const STARTUP_SNAPSHOT_TIMEOUT_MS = 10_000

export function useStartupSnapshots({ showToast }: UseStartupSnapshotsParams): {
  snapshotsReady: boolean
  announceAppliedScheduleUpdates: (
    notices: Awaited<ReturnType<typeof StorageService.materializePendingSnapshots>>,
  ) => void
} {
  const [snapshotsReady, setSnapshotsReady] = useState(false)

  const announceAppliedScheduleUpdates = useCallback(
    (notices: Awaited<ReturnType<typeof StorageService.materializePendingSnapshots>>) => {
      if (!notices || notices.length === 0) return
      showToast({
        message: summarizeScheduleMaterializationNotices(notices),
        tone: 'success',
        durationMs: 6500,
      })
    },
    [showToast],
  )

  useEffect(() => {
    const init = async () => {
      console.debug('[startup-snapshots] begin')
      const hasVisited = localStorage.getItem('outflow:hasVisited') === 'true'
      const fakeDelay = (window as unknown as { outflowTestApi?: unknown }).outflowTestApi
        ? 0
        : hasVisited
          ? 0
          : 800
      const startTime = Date.now()
      let appliedNotices: Awaited<ReturnType<typeof StorageService.materializePendingSnapshots>> = []
      let startupFailed = false

      try {
        appliedNotices = await withTimeout(
          StorageService.materializePendingSnapshots?.() ?? Promise.resolve([]),
          STARTUP_SNAPSHOT_TIMEOUT_MS,
          '[startup-snapshots] materializePendingSnapshots timed out',
        )
        console.debug(
          '[startup-snapshots] materialize complete',
          Array.isArray(appliedNotices) ? appliedNotices.length : 0,
        )
      } catch (error) {
        startupFailed = true
        console.error('[startup-snapshots] materialize failed', error)
      }

      try {
        await withTimeout(
          StorageService.rolloverSnapshots?.() ?? Promise.resolve(),
          STARTUP_SNAPSHOT_TIMEOUT_MS,
          '[startup-snapshots] rolloverSnapshots timed out',
        )
        console.debug('[startup-snapshots] rollover complete')
      } catch (error) {
        startupFailed = true
        console.error('[startup-snapshots] rollover failed', error)
      }

      try {
        const remaining = Math.max(0, fakeDelay - (Date.now() - startTime))
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining))
        }
      } finally {
        if (startupFailed) {
          showToast({
            message:
              'Startup snapshot sync was incomplete. Your data is still available, and you can continue using the app.',
            tone: 'warning',
            durationMs: 7000,
          })
        }
        setSnapshotsReady(true)
        announceAppliedScheduleUpdates(appliedNotices ?? [])
        if (!hasVisited) {
          localStorage.setItem('outflow:hasVisited', 'true')
        }
        console.debug('[startup-snapshots] end', startupFailed ? 'with-fallback' : 'success')
      }
    }

    void init()
  }, [announceAppliedScheduleUpdates, showToast])

  return {
    snapshotsReady,
    announceAppliedScheduleUpdates,
  }
}
