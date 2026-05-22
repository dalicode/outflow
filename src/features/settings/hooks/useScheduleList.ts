import { useCallback, useEffect, useState } from 'react'
import { StorageService } from '../../../services/storageService'
import type { Schedule } from '../../../types'

interface UseScheduleListParams {
  onLocalMutation?: () => void
}

export function useScheduleList({ onLocalMutation }: UseScheduleListParams = {}) {
  const [schedules, setSchedules] = useState<Schedule[]>([])

  const loadSchedules = useCallback(async () => {
    const all = await StorageService.getSchedules()
    setSchedules(all as Schedule[])
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  const deleteSchedule = useCallback(
    async (id: number) => {
      await StorageService.deleteSchedule(id)
      await loadSchedules()
      onLocalMutation?.()
    },
    [loadSchedules, onLocalMutation],
  )

  return {
    schedules,
    loadSchedules,
    deleteSchedule,
  }
}
