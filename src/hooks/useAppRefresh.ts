import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { StorageService } from '../services/storageService'
import { checkForServiceWorkerUpdate } from '../utils/serviceWorkerUpdates'
import {
  LOCAL_ONLY_MAINTENANCE_PENDING_RECONCILE_KEY,
  runSnapshotMaintenance,
} from './useStartupSnapshots'
import type { ScheduleMaterializationNotice } from '../types'

interface UseAppRefreshParams {
  pullAppliedCount: number
  refreshExpenses: () => Promise<void>
  refreshCategories: () => Promise<void>
  refreshPayees: () => Promise<void>
  refreshTags: () => Promise<void>
  loadSettings: () => Promise<void>
  announceAppliedScheduleUpdates: (notices: ScheduleMaterializationNotice[]) => void
  showToast: (toast: {
    message: string
    tone: 'success' | 'warning' | 'danger' | 'default'
    durationMs?: number
  }) => string
  syncNow: () => Promise<void>
  user: unknown
  forceFinanceDataRefresh?: () => void
}

export function useAppRefresh({
  pullAppliedCount,
  refreshExpenses,
  refreshCategories,
  refreshPayees,
  refreshTags,
  loadSettings,
  announceAppliedScheduleUpdates,
  showToast,
  syncNow,
  user,
  forceFinanceDataRefresh,
}: UseAppRefreshParams): {
  handlePullRefresh: () => Promise<void>
} {
  const suppressManualPullAppliedCountRef = useRef<number | null>(null)
  const lastResumeMaintenanceAtRef = useRef(0)

  const refreshLocalDataAndSettings = useCallback(async () => {
    await Promise.all([
      refreshExpenses(),
      refreshCategories(),
      refreshPayees(),
      refreshTags(),
      loadSettings(),
    ])
  }, [loadSettings, refreshCategories, refreshExpenses, refreshPayees, refreshTags])

  const runMaintenanceAfterLocalRefresh = useCallback(
    async ({
      debugLabel,
      warningMessage,
      clearReconcileFlag = false,
    }: {
      debugLabel: string
      warningMessage: string
      clearReconcileFlag?: boolean
    }) => {
      const { appliedNotices, ran, succeeded } = await runSnapshotMaintenance({
        showToast,
        debugLabel,
        warningMessage,
      })
      if (succeeded && clearReconcileFlag) {
        const shouldClearReconcileFlag = await StorageService.getSetting(
          LOCAL_ONLY_MAINTENANCE_PENDING_RECONCILE_KEY,
          false,
        )
        if (shouldClearReconcileFlag) {
          await StorageService.setLocalSetting(LOCAL_ONLY_MAINTENANCE_PENDING_RECONCILE_KEY, false)
        }
      }
      if (ran && succeeded) {
        forceFinanceDataRefresh?.()
      }
      announceAppliedScheduleUpdates(appliedNotices ?? [])
      return { ran, succeeded }
    },
    [announceAppliedScheduleUpdates, forceFinanceDataRefresh, showToast],
  )

  useEffect(() => {
    if (pullAppliedCount === 0) return
    if (
      suppressManualPullAppliedCountRef.current !== null &&
      pullAppliedCount > suppressManualPullAppliedCountRef.current
    ) {
      suppressManualPullAppliedCountRef.current = null
      return
    }

    const applyPulledData = async () => {
      try {
        await refreshLocalDataAndSettings()
        await runMaintenanceAfterLocalRefresh({
          debugLabel: 'pull-applied-maintenance',
          warningMessage:
            'Background snapshot sync was incomplete. Your data is still available, and you can continue using the app.',
          clearReconcileFlag: true,
        })
      } catch (error) {
        console.error('Pull-applied refresh failed:', error)
        showToast({
          message: "Refresh didn't finish. Try again in a moment.",
          tone: 'warning',
          durationMs: 4000,
        })
      }
    }

    void applyPulledData()
  }, [
    pullAppliedCount,
    refreshLocalDataAndSettings,
    forceFinanceDataRefresh,
    announceAppliedScheduleUpdates,
    runMaintenanceAfterLocalRefresh,
    showToast,
  ])

  useEffect(() => {
    const runResumeMaintenance = async (debugLabel: string) => {
      const now = Date.now()
      if (now - lastResumeMaintenanceAtRef.current < 1000) return
      lastResumeMaintenanceAtRef.current = now

      try {
        const { appliedNotices, ran, succeeded } = await runSnapshotMaintenance({
          showToast,
          debugLabel,
          warningMessage:
            'Background snapshot sync was incomplete. Your data is still available, and you can continue using the app.',
        })
        if (ran && succeeded) {
          await refreshLocalDataAndSettings()
          forceFinanceDataRefresh?.()
        }
        announceAppliedScheduleUpdates(appliedNotices ?? [])
      } catch (error) {
        console.error('Resume snapshot maintenance failed:', error)
        showToast({
          message: "Refresh didn't finish. Try again in a moment.",
          tone: 'warning',
          durationMs: 4000,
        })
      }
    }

    const handleFocus = () => {
      void runResumeMaintenance('focus-maintenance')
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      void runResumeMaintenance('visibility-maintenance')
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    announceAppliedScheduleUpdates,
    forceFinanceDataRefresh,
    refreshLocalDataAndSettings,
    showToast,
  ])

  const handlePullRefresh = useCallback(async () => {
    try {
      const serviceWorkerUpdateCheck = checkForServiceWorkerUpdate().catch(() => undefined)

      const isOnline =
        typeof navigator === 'undefined' || !('onLine' in navigator) || navigator.onLine
      if (isOnline && supabase && user) {
        suppressManualPullAppliedCountRef.current = pullAppliedCount
        await syncNow()
      }

      await refreshLocalDataAndSettings()
      await runMaintenanceAfterLocalRefresh({
        debugLabel: 'pull-refresh-maintenance',
        warningMessage: "Refresh didn't finish. Try again in a moment.",
      })

      await serviceWorkerUpdateCheck

      showToast({
        message: 'Updated',
        tone: 'success',
        durationMs: 2500,
      })
    } catch (error) {
      suppressManualPullAppliedCountRef.current = null
      console.error('Pull refresh failed:', error)
      showToast({
        message: "Refresh didn't finish. Try again in a moment.",
        tone: 'warning',
        durationMs: 4000,
      })
    }
  }, [
    refreshLocalDataAndSettings,
    announceAppliedScheduleUpdates,
    runMaintenanceAfterLocalRefresh,
    pullAppliedCount,
    syncNow,
    showToast,
    user,
    forceFinanceDataRefresh,
  ])

  return { handlePullRefresh }
}
