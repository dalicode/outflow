import { useCallback, useEffect } from 'react'
import {
  materializePendingSnapshots,
  rolloverSnapshots,
} from '../services/repositories/scheduleRepository'
import { supabase } from '../services/supabase'
import { checkForServiceWorkerUpdate } from '../utils/serviceWorkerUpdates'
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
  useEffect(() => {
    if (pullAppliedCount === 0) return
    void Promise.all([
      refreshExpenses(),
      refreshCategories(),
      refreshPayees(),
      refreshTags(),
      loadSettings(),
    ]).then(() => forceFinanceDataRefresh?.())
  }, [
    pullAppliedCount,
    refreshPayees,
    refreshTags,
    refreshExpenses,
    refreshCategories,
    loadSettings,
    forceFinanceDataRefresh,
  ])

  const handlePullRefresh = useCallback(async () => {
    try {
      const serviceWorkerUpdateCheck = checkForServiceWorkerUpdate().catch(() => undefined)
      const appliedNotices = await materializePendingSnapshots().catch(console.error)
      await rolloverSnapshots().catch(console.error)
      await Promise.all([refreshExpenses(), refreshCategories(), refreshPayees(), refreshTags()])
      forceFinanceDataRefresh?.()

      announceAppliedScheduleUpdates(appliedNotices ?? [])

      if (navigator.onLine && supabase && user) {
        await syncNow()
      }

      await serviceWorkerUpdateCheck

      showToast({
        message: 'Updated',
        tone: 'success',
        durationMs: 2500,
      })
    } catch (error) {
      console.error('Pull refresh failed:', error)
      showToast({
        message: "Refresh didn't finish. Try again in a moment.",
        tone: 'warning',
        durationMs: 4000,
      })
    }
  }, [
    refreshExpenses,
    refreshCategories,
    refreshPayees,
    refreshTags,
    announceAppliedScheduleUpdates,
    syncNow,
    showToast,
    user,
    forceFinanceDataRefresh,
  ])

  return { handlePullRefresh }
}
