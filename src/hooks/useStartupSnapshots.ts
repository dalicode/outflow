import { useCallback, useEffect, useRef } from 'react'
import {
  hasActiveUnmaterializedDueSchedule,
  materializePendingSnapshots,
  rolloverSnapshots,
} from '../services/repositories/scheduleRepository'
import { StorageService } from '../services/storageService'
import { getLocalDayKey } from '../services/repositories/common'
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
  supabaseConfigured?: boolean
  isSignedIn?: boolean
  isOnline?: boolean
}

const STARTUP_SNAPSHOT_TIMEOUT_MS = 10_000
const STARTUP_SNAPSHOT_WARNING =
  'Startup snapshot sync was incomplete. Your data is still available, and you can continue using the app.'
export const LOCAL_ONLY_MAINTENANCE_PENDING_RECONCILE_KEY =
  'localOnlyMaintenancePendingReconcile'
export const LAST_SNAPSHOT_MAINTENANCE_DAY_KEY = 'lastSnapshotMaintenanceDayKey'

interface RunSnapshotMaintenanceParams {
  showToast: UseStartupSnapshotsParams['showToast']
  debugLabel?: string
  warningMessage?: string
}

interface SnapshotMaintenanceResult {
  appliedNotices: ScheduleMaterializationNotice[]
  ran: boolean
  succeeded: boolean
}

export function shouldMarkLocalOnlyMaintenancePendingReconcile({
  supabaseConfigured,
  isSignedIn,
  isOnline,
}: {
  supabaseConfigured?: boolean
  isSignedIn?: boolean
  isOnline?: boolean
}): boolean {
  if (!supabaseConfigured) return false
  if (!isSignedIn) return true
  return !isOnline
}

export async function markLocalOnlyMaintenancePendingReconcile(): Promise<void> {
  await StorageService.setLocalSetting(LOCAL_ONLY_MAINTENANCE_PENDING_RECONCILE_KEY, true)
}

export async function runSnapshotMaintenance({
  showToast,
  debugLabel = 'startup-snapshots',
  warningMessage = STARTUP_SNAPSHOT_WARNING,
}: RunSnapshotMaintenanceParams): Promise<SnapshotMaintenanceResult> {
  console.debug(`[${debugLabel}] begin`)
  const startedDayKey = getLocalDayKey()
  let shouldRunMaintenance = true

  try {
    const [lastMaintenanceDayKey, hasDueSchedule] = await Promise.all([
      StorageService.getSetting<string | null>(LAST_SNAPSHOT_MAINTENANCE_DAY_KEY, null),
      hasActiveUnmaterializedDueSchedule(),
    ])
    shouldRunMaintenance =
      !lastMaintenanceDayKey || lastMaintenanceDayKey !== startedDayKey || hasDueSchedule
    console.debug(`[${debugLabel}] gate`, {
      lastMaintenanceDayKey,
      todayKey: startedDayKey,
      hasDueSchedule,
      shouldRunMaintenance,
    })
  } catch (error) {
    console.error(`[${debugLabel}] gate check failed; running maintenance`, error)
  }

  if (!shouldRunMaintenance) {
    console.debug(`[${debugLabel}] end`, 'skipped')
    return {
      appliedNotices: [],
      ran: false,
      succeeded: true,
    }
  }

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
      await withTimeout(
        StorageService.setLocalSetting(LAST_SNAPSHOT_MAINTENANCE_DAY_KEY, getLocalDayKey()),
        STARTUP_SNAPSHOT_TIMEOUT_MS,
        `[${debugLabel}] lastSnapshotMaintenanceDayKey update timed out`,
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
    ran: true,
    succeeded: !startupFailed,
  }
}

export function useStartupSnapshots({
  showToast,
  readyToStart = true,
  onSnapshotsUpdated,
  supabaseConfigured = false,
  isSignedIn = false,
  isOnline = true,
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
      const { appliedNotices, ran, succeeded } = await runSnapshotMaintenance({ showToast })
      if (ran && succeeded) {
        if (
          shouldMarkLocalOnlyMaintenancePendingReconcile({
            supabaseConfigured,
            isSignedIn,
            isOnline,
          })
        ) {
          await markLocalOnlyMaintenancePendingReconcile()
        }
        onSnapshotsUpdated?.()
      }
      announceAppliedScheduleUpdates(appliedNotices ?? [])
    }

    void init()
  }, [
    announceAppliedScheduleUpdates,
    isOnline,
    isSignedIn,
    onSnapshotsUpdated,
    readyToStart,
    showToast,
    supabaseConfigured,
  ])

  return {
    announceAppliedScheduleUpdates,
  }
}
