import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { StorageService } from '../services/storageService'
import type { Expense } from '../types'

const areExpenseListsEqual = (left: Expense[], right: Expense[]): boolean => {
  if (left.length !== right.length) return false
  return left.every((expense, index) => JSON.stringify(expense) === JSON.stringify(right[index]))
}

export const useExpenses = () => {
  const liveExpenses = useLiveQuery(() => StorageService.getAll(), [])
  const [optimisticExpenses, setOptimisticExpenses] = useState<Expense[] | null>(null)

  const resolvedLiveExpenses = liveExpenses ?? []

  useEffect(() => {
    if (!optimisticExpenses) return
    if (!areExpenseListsEqual(optimisticExpenses, resolvedLiveExpenses)) return
    setOptimisticExpenses(null)
  }, [optimisticExpenses, resolvedLiveExpenses])

  const setExpenses = useCallback<Dispatch<SetStateAction<Expense[]>>>(
    (nextExpenses) => {
      setOptimisticExpenses((previousOptimistic) => {
        const baseExpenses = previousOptimistic ?? resolvedLiveExpenses
        if (typeof nextExpenses === 'function') {
          return nextExpenses(baseExpenses)
        }
        return nextExpenses
      })
    },
    [resolvedLiveExpenses],
  )

  const refresh = useCallback(async () => {
    setOptimisticExpenses((await StorageService.getAll()) as Expense[])
  }, [])

  const expenses = useMemo(
    () => optimisticExpenses ?? resolvedLiveExpenses,
    [optimisticExpenses, resolvedLiveExpenses],
  )

  return { expenses, setExpenses, refresh }
}
