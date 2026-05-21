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
}: UseAppRefreshParams): {
  handlePullRefresh: () => Promise<void>
} {
  useEffect(() => {
    if (syncCount === 0) return
    void refreshExpenses()
    void refreshCategories()
    void refreshPayees()
    void loadSettings()
  }, [syncCount, refreshPayees, refreshExpenses, refreshCategories, loadSettings])

  const handlePullRefresh = useCallback(async () => {
    try {
      const appliedNotices = await StorageService.materializePendingSnapshots?.().catch(
        console.error,
      )
      await StorageService.rolloverSnapshots?.().catch(console.error)
      await Promise.all([refreshExpenses(), refreshCategories(), refreshPayees()])

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
  ])

  return { handlePullRefresh }
}
