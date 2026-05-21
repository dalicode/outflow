import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { StorageService } from '../services/storageService'
import type { Expense } from '../types'

const DELETE_DELAY_MS = 2000

interface UseOptimisticExpenseDeleteParams {
  expenses: Expense[]
  setExpenses: Dispatch<SetStateAction<Expense[]>>
  refreshExpenses: () => Promise<void>
  triggerSync?: () => void
  showUndoToast: (message: string, onUndo: () => void | Promise<void>) => string
}

export function useOptimisticExpenseDelete({
  expenses,
  setExpenses,
  refreshExpenses,
  triggerSync,
  showUndoToast,
}: UseOptimisticExpenseDeleteParams): {
  visibleExpenses: Expense[]
  handleDelete: (id: number) => Promise<void>
  handleBulkDelete: (ids: number[]) => Promise<void>
} {
  const [pendingExpenseDeleteIds, setPendingExpenseDeleteIds] = useState<number[]>([])
  const pendingExpenseDeleteTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const committedExpenseDeleteIdsRef = useRef<Set<number>>(new Set())

  const handleDelete = async (id: number) => {
    const expense = expenses.find((item) => item.id === id)
    if (!expense) return
    const removedIndex = expenses.findIndex((item) => item.id === id)

    const timer = setTimeout(async () => {
      committedExpenseDeleteIdsRef.current.add(id)
      try {
        await StorageService.remove(id)
        triggerSync?.()
        await refreshExpenses()
      } finally {
        pendingExpenseDeleteTimersRef.current = pendingExpenseDeleteTimersRef.current.filter(
          (item) => item !== timer,
        )
        setPendingExpenseDeleteIds((current) => current.filter((pendingId) => pendingId !== id))
      }
    }, DELETE_DELAY_MS)

    pendingExpenseDeleteTimersRef.current.push(timer)
    setPendingExpenseDeleteIds((current) => [...new Set([...current, id])])
    setExpenses((prev) => prev.filter((item) => item.id !== id))
    showUndoToast(`Deleted ${expense.description?.trim() || 'expense'}.`, async () => {
      clearTimeout(timer)
      pendingExpenseDeleteTimersRef.current = pendingExpenseDeleteTimersRef.current.filter(
        (item) => item !== timer,
      )

      const timerFired = committedExpenseDeleteIdsRef.current.has(id)
      setPendingExpenseDeleteIds((current) => {
        return current.filter((pendingId) => pendingId !== id)
      })

      if (timerFired) {
        committedExpenseDeleteIdsRef.current.delete(id)
        await StorageService.add(expense)
        triggerSync?.()
      }

      setExpenses((prev) => {
        if (prev.some((item) => item.id === id)) return prev
        const restored = [...prev]
        restored.splice(Math.min(removedIndex, restored.length), 0, expense)
        return restored
      })
    })
  }

  const handleBulkDelete = async (ids: number[]) => {
    const selected = expenses.filter((expense) => ids.includes(expense.id as number))
    if (selected.length === 0) return

    const selectedIdSet = new Set(ids)
    const positions = selected.map((expense) => ({
      expense,
      index: expenses.findIndex((item) => item.id === expense.id),
    }))

    const timer = setTimeout(async () => {
      ids.forEach((id) => {
        committedExpenseDeleteIdsRef.current.add(id)
      })
      try {
        await StorageService.removeMany(ids)
        triggerSync?.()
        await refreshExpenses()
      } finally {
        pendingExpenseDeleteTimersRef.current = pendingExpenseDeleteTimersRef.current.filter(
          (item) => item !== timer,
        )
        setPendingExpenseDeleteIds((current) =>
          current.filter((pendingId) => !selectedIdSet.has(pendingId)),
        )
      }
    }, DELETE_DELAY_MS)

    pendingExpenseDeleteTimersRef.current.push(timer)
    setPendingExpenseDeleteIds((current) => [...new Set([...current, ...ids])])
    setExpenses((prev) => prev.filter((expense) => !selectedIdSet.has(expense.id as number)))
    showUndoToast(`Deleted ${selected.length} expenses.`, async () => {
      clearTimeout(timer)
      pendingExpenseDeleteTimersRef.current = pendingExpenseDeleteTimersRef.current.filter(
        (item) => item !== timer,
      )

      const timerFired = ids.some((id) => committedExpenseDeleteIdsRef.current.has(id))
      setPendingExpenseDeleteIds((current) => {
        return current.filter((pendingId) => !selectedIdSet.has(pendingId))
      })

      if (timerFired) {
        ids.forEach((id) => {
          committedExpenseDeleteIdsRef.current.delete(id)
        })
        for (const expense of selected) {
          await StorageService.add(expense)
        }
        triggerSync?.()
      }

      setExpenses((prev) => {
        const restored = [...prev]
        positions
          .slice()
          .sort((a, b) => a.index - b.index)
          .forEach(({ expense, index }) => {
            if (restored.some((item) => item.id === expense.id)) return
            restored.splice(Math.min(index, restored.length), 0, expense)
          })
        return restored
      })
    })
  }

  useEffect(
    () => () => {
      pendingExpenseDeleteTimersRef.current.forEach((timer) => {
        clearTimeout(timer)
      })
      pendingExpenseDeleteTimersRef.current = []
      committedExpenseDeleteIdsRef.current.clear()
    },
    [],
  )

  const visibleExpenses = useMemo(
    () => expenses.filter((expense) => !pendingExpenseDeleteIds.includes(expense.id as number)),
    [expenses, pendingExpenseDeleteIds],
  )

  return {
    visibleExpenses,
    handleDelete,
    handleBulkDelete,
  }
}
