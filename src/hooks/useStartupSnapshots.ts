import { useCallback, useEffect, useState } from 'react'
import {
  materializePendingSnapshots,
  rolloverSnapshots,
} from '../services/repositories/scheduleRepository'
import { summarizeScheduleMaterializationNotices } from '../utils/scheduleNotificationUtils'
import { withTimeout } from '../lib/withTimeout'
import type { ScheduleMaterializationNotice } from '../types'

interface UseStartupSnapshotsParams {
  showToast: (toast: {
    message: string
    tone: 'success' | 'warning' | 'danger' | 'default'
    durationMs?: number
  }) => string
  preStartupPull?: () => Promise<void>
  readyToStart?: boolean
}

const STARTUP_SNAPSHOT_TIMEOUT_MS = 10_000

export function useStartupSnapshots({
  showToast,
  preStartupPull,
  readyToStart = true,
}: UseStartupSnapshotsParams): {
  snapshotsReady: boolean
  announceAppliedScheduleUpdates: (notices: ScheduleMaterializationNotice[]) => void
} {
  const [snapshotsReady, setSnapshotsReady] = useState(false)

  const announceAppliedScheduleUpdates = useCallback(
    (notices: ScheduleMaterializationNotice[]) => {
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
    if (!readyToStart) return

    const init = async () => {
      console.debug('[startup-snapshots] begin')
      const hasVisited = localStorage.getItem('outflow:hasVisited') === 'true'
      const fakeDelay = (window as unknown as { outflowTestApi?: unknown }).outflowTestApi
        ? 0
        : hasVisited
          ? 0
          : 800
      const startTime = Date.now()
      let appliedNotices: ScheduleMaterializationNotice[] = []
      let startupFailed = false
      let materializationSucceeded = false

      if (preStartupPull) {
        try {
          await withTimeout(
            preStartupPull(),
            STARTUP_SNAPSHOT_TIMEOUT_MS,
            '[startup-snapshots] preStartupPull timed out',
          )
          console.debug('[startup-snapshots] pre-startup pull complete')
        } catch (error) {
          console.error('[startup-snapshots] pre-startup pull failed', error)
        }
      }

      try {
        appliedNotices = await withTimeout(
          materializePendingSnapshots(),
          STARTUP_SNAPSHOT_TIMEOUT_MS,
          '[startup-snapshots] materializePendingSnapshots timed out',
        )
        materializationSucceeded = true
        console.debug(
          '[startup-snapshots] materialize complete',
          Array.isArray(appliedNotices) ? appliedNotices.length : 0,
        )
      } catch (error) {
        startupFailed = true
        console.error('[startup-snapshots] materialize failed', error)
      }

      if (materializationSucceeded) {
        try {
          await withTimeout(
            rolloverSnapshots(),
            STARTUP_SNAPSHOT_TIMEOUT_MS,
            '[startup-snapshots] rolloverSnapshots timed out',
          )
          console.debug('[startup-snapshots] rollover complete')
        } catch (error) {
          startupFailed = true
          console.error('[startup-snapshots] rollover failed', error)
        }
      } else {
        console.debug('[startup-snapshots] rollover skipped due to materialize failure')
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
  }, [announceAppliedScheduleUpdates, preStartupPull, readyToStart, showToast])

  return {
    snapshotsReady,
    announceAppliedScheduleUpdates,
  }
}
