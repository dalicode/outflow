import { useCallback, useEffect, useState } from 'react'
import type { Expense } from '../../../types'

export function useDashboardSelection(
  filteredExpenses: Expense[],
  onBulkDelete: (ids: number[]) => void,
  onSelectionChange?: (active: boolean) => void,
) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    onSelectionChange?.(selectedIds.size > 0)
  }, [selectedIds, onSelectionChange])

  const toggleExpenseSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredExpenses.length) return new Set()
      return new Set(filteredExpenses.map((e) => e.id as number))
    })
  }, [filteredExpenses])

  const openDeleteConfirmation = useCallback(() => {
    if (selectedIds.size === 0) return
    setIsDeleteConfirmOpen(true)
  }, [selectedIds])

  const confirmBulkDelete = useCallback(() => {
    onBulkDelete(Array.from(selectedIds))
    setSelectedIds(new Set())
    setIsDeleteConfirmOpen(false)
  }, [selectedIds, onBulkDelete])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  return {
    selectedIds,
    isDeleteConfirmOpen,
    setIsDeleteConfirmOpen,
    toggleExpenseSelection,
    toggleSelectAll,
    openDeleteConfirmation,
    confirmBulkDelete,
    clearSelection,
  }
}
