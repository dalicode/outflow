import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppRefresh } from '../hooks/useAppRefresh'

describe('useAppRefresh', () => {
  it('refreshes non-reactive readers when pullAppliedCount increments', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshTags = vi.fn().mockResolvedValue(undefined)
    const loadSettings = vi.fn().mockResolvedValue(undefined)
    const forceFinanceDataRefresh = vi.fn()

    const { rerender } = renderHook(
      ({ pullAppliedCount }: { pullAppliedCount: number }) =>
        useAppRefresh({
          pullAppliedCount,
          refreshExpenses,
          refreshCategories,
          refreshPayees,
          refreshTags,
          loadSettings,
          announceAppliedScheduleUpdates: vi.fn(),
          showToast: vi.fn(),
          syncNow: vi.fn(),
          user: null,
          forceFinanceDataRefresh,
        }),
      { initialProps: { pullAppliedCount: 0 } },
    )

    expect(refreshExpenses).not.toHaveBeenCalled()
    expect(refreshCategories).not.toHaveBeenCalled()
    expect(refreshPayees).not.toHaveBeenCalled()
    expect(refreshTags).not.toHaveBeenCalled()
    expect(loadSettings).not.toHaveBeenCalled()

    rerender({ pullAppliedCount: 1 })

    await waitFor(() => {
      expect(refreshExpenses).toHaveBeenCalledTimes(1)
      expect(refreshCategories).toHaveBeenCalledTimes(1)
      expect(refreshPayees).toHaveBeenCalledTimes(1)
      expect(refreshTags).toHaveBeenCalledTimes(1)
      expect(loadSettings).toHaveBeenCalledTimes(1)
      expect(forceFinanceDataRefresh).toHaveBeenCalledTimes(1)
    })
  })
})
