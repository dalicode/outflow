import { useCallback, useEffect, useState } from 'react'
import { StorageService } from '../services/storageService'
import { summarizeScheduleMaterializationNotices } from '../utils/scheduleNotificationUtils'

interface UseStartupSnapshotsParams {
  showToast: (toast: {
    message: string
    tone: 'success' | 'warning' | 'danger' | 'default'
    durationMs?: number
  }) => string
}

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
      const hasVisited = localStorage.getItem('outflow:hasVisited') === 'true'
      const fakeDelay = (window as unknown as { outflowTestApi?: unknown }).outflowTestApi
        ? 0
        : hasVisited
          ? 0
          : 800
      const startTime = Date.now()

      const appliedNotices = await StorageService.materializePendingSnapshots?.().catch(
        console.error,
      )
      await StorageService.rolloverSnapshots?.().catch(console.error)

      const remaining = Math.max(0, fakeDelay - (Date.now() - startTime))
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining))
      }

      setSnapshotsReady(true)
      announceAppliedScheduleUpdates(appliedNotices ?? [])
      if (!hasVisited) {
        localStorage.setItem('outflow:hasVisited', 'true')
      }
    }

    void init()
  }, [announceAppliedScheduleUpdates])

  return {
    snapshotsReady,
    announceAppliedScheduleUpdates,
  }
}
