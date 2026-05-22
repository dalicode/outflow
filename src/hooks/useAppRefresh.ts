import { useCallback, useEffect } from 'react'
import { StorageService } from '../services/storageService'
import { supabase } from '../services/supabase'

interface UseAppRefreshParams {
  syncCount: number
  refreshExpenses: () => Promise<void>
  refreshCategories: () => Promise<void>
  refreshPayees: () => Promise<void>
  loadSettings: () => Promise<void>
  announceAppliedScheduleUpdates: (
    notices: Awaited<ReturnType<typeof StorageService.materializePendingSnapshots>>,
  ) => void
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
  syncCount,
  refreshExpenses,
  refreshCategories,
  refreshPayees,
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
    if (syncCount === 0) return
    void Promise.all([
      refreshExpenses(),
      refreshCategories(),
      refreshPayees(),
      loadSettings(),
    ]).then(() => forceFinanceDataRefresh?.())
  }, [
    syncCount,
    refreshPayees,
    refreshExpenses,
    refreshCategories,
    loadSettings,
    forceFinanceDataRefresh,
  ])

  const handlePullRefresh = useCallback(async () => {
    try {
      const appliedNotices = await StorageService.materializePendingSnapshots?.().catch(
        console.error,
      )
      await StorageService.rolloverSnapshots?.().catch(console.error)
      await Promise.all([refreshExpenses(), refreshCategories(), refreshPayees()])
      forceFinanceDataRefresh?.()

      announceAppliedScheduleUpdates(appliedNotices ?? [])

      if (navigator.onLine && supabase && user) {
        await syncNow()
      }

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
    announceAppliedScheduleUpdates,
    syncNow,
    showToast,
    user,
    forceFinanceDataRefresh,
  ])

  return { handlePullRefresh }
}
