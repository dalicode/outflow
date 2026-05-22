import { useCallback, useEffect, useState } from 'react'
import { StorageService } from '../../../services/storageService'
import type { Schedule } from '../../../types'

export function useScheduleList() {
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
    },
    [loadSchedules],
  )

  return {
    schedules,
    loadSchedules,
    deleteSchedule,
  }
}
