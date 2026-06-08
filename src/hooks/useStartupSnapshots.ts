import { useCallback, useEffect, useRef } from 'react'
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
  readyToStart?: boolean
  onSnapshotsUpdated?: () => void
}

const STARTUP_SNAPSHOT_TIMEOUT_MS = 10_000
const STARTUP_SNAPSHOT_WARNING =
  'Startup snapshot sync was incomplete. Your data is still available, and you can continue using the app.'

interface RunSnapshotMaintenanceParams {
  showToast: UseStartupSnapshotsParams['showToast']
  debugLabel?: string
  warningMessage?: string
}

interface SnapshotMaintenanceResult {
  appliedNotices: ScheduleMaterializationNotice[]
  succeeded: boolean
}

export async function runSnapshotMaintenance({
  showToast,
  debugLabel = 'startup-snapshots',
  warningMessage = STARTUP_SNAPSHOT_WARNING,
}: RunSnapshotMaintenanceParams): Promise<SnapshotMaintenanceResult> {
  console.debug(`[${debugLabel}] begin`)
  let appliedNotices: ScheduleMaterializationNotice[] = []
  let startupFailed = false
  let materializationSucceeded = false

  try {
    appliedNotices = await withTimeout(
      materializePendingSnapshots(),
      STARTUP_SNAPSHOT_TIMEOUT_MS,
      `[${debugLabel}] materializePendingSnapshots timed out`,
    )
    materializationSucceeded = true
    console.debug(
      `[${debugLabel}] materialize complete`,
      Array.isArray(appliedNotices) ? appliedNotices.length : 0,
    )
  } catch (error) {
    startupFailed = true
    console.error(`[${debugLabel}] materialize failed`, error)
  }

  if (materializationSucceeded) {
    try {
      await withTimeout(
        rolloverSnapshots(),
        STARTUP_SNAPSHOT_TIMEOUT_MS,
        `[${debugLabel}] rolloverSnapshots timed out`,
      )
      console.debug(`[${debugLabel}] rollover complete`)
    } catch (error) {
      startupFailed = true
      console.error(`[${debugLabel}] rollover failed`, error)
    }
  } else {
    console.debug(`[${debugLabel}] rollover skipped due to materialize failure`)
  }

  if (startupFailed) {
    showToast({
      message: warningMessage,
      tone: 'warning',
      durationMs: 7000,
    })
  }

  console.debug(`[${debugLabel}] end`, startupFailed ? 'with-fallback' : 'success')
  return {
    appliedNotices,
    succeeded: !startupFailed,
  }
}

export function useStartupSnapshots({
  showToast,
  readyToStart = true,
  onSnapshotsUpdated,
}: UseStartupSnapshotsParams): {
  announceAppliedScheduleUpdates: (notices: ScheduleMaterializationNotice[]) => void
} {
  const hasStartedRef = useRef(false)

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
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    const init = async () => {
      const { appliedNotices, succeeded } = await runSnapshotMaintenance({ showToast })
      if (succeeded) {
        onSnapshotsUpdated?.()
      }
      announceAppliedScheduleUpdates(appliedNotices ?? [])
    }

    void init()
  }, [announceAppliedScheduleUpdates, onSnapshotsUpdated, readyToStart, showToast])

  return {
    announceAppliedScheduleUpdates,
  }
}
