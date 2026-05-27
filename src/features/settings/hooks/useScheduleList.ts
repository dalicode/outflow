import { useCallback, useEffect, useState } from 'react'
import {
  deleteSchedule as deleteScheduleRow,
  getSchedules,
} from '../../../services/repositories/scheduleRepository'
import type { Schedule } from '../../../types'

interface UseScheduleListParams {
  onLocalMutation?: () => void
}

export function useScheduleList({ onLocalMutation }: UseScheduleListParams = {}) {
  const [schedules, setSchedules] = useState<Schedule[]>([])

  const loadSchedules = useCallback(async () => {
    const all = await getSchedules()
    setSchedules(all as Schedule[])
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  const deleteSchedule = useCallback(
    async (id: number) => {
      await deleteScheduleRow(id)
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
