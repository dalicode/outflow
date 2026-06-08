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

  const refreshLocalDataAndSettings = useCallback(async () => {
    await Promise.all([
      refreshExpenses(),
      refreshCategories(),
      refreshPayees(),
      refreshTags(),
      loadSettings(),
    ])
  }, [loadSettings, refreshCategories, refreshExpenses, refreshPayees, refreshTags])

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
        const { appliedNotices, succeeded } = await runSnapshotMaintenance({
          showToast,
          debugLabel: 'pull-applied-maintenance',
          warningMessage:
            'Background snapshot sync was incomplete. Your data is still available, and you can continue using the app.',
        })
        if (succeeded) {
          const shouldClearReconcileFlag = await StorageService.getSetting(
            LOCAL_ONLY_MAINTENANCE_PENDING_RECONCILE_KEY,
            false,
          )
          if (shouldClearReconcileFlag) {
            await StorageService.setLocalSetting(
              LOCAL_ONLY_MAINTENANCE_PENDING_RECONCILE_KEY,
              false,
            )
          }
          forceFinanceDataRefresh?.()
        }
        announceAppliedScheduleUpdates(appliedNotices ?? [])
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
      const { appliedNotices, succeeded } = await runSnapshotMaintenance({
        showToast,
        debugLabel: 'pull-refresh-maintenance',
        warningMessage: "Refresh didn't finish. Try again in a moment.",
      })
      if (succeeded) {
        forceFinanceDataRefresh?.()
      }
      announceAppliedScheduleUpdates(appliedNotices ?? [])

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
    pullAppliedCount,
    syncNow,
    showToast,
    user,
    forceFinanceDataRefresh,
  ])

  return { handlePullRefresh }
}
