import { useCallback, useEffect, useState } from 'react'
import { StorageService } from '../services/storageService'
import type { Expense } from '../types'

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([])

  useEffect(() => {
    StorageService.getAll().then((data: Expense[]) => setExpenses(data))
  }, [])

  const refresh = useCallback(async () => {
    setExpenses((await StorageService.getAll()) as Expense[])
  }, [])

  return { expenses, setExpenses, refresh }
}
