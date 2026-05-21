import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOptimisticExpenseDelete } from '../hooks/useOptimisticExpenseDelete'
import type { Expense } from '../types'

const { remove, removeMany, add } = vi.hoisted(() => ({
  remove: vi.fn(),
  removeMany: vi.fn(),
  add: vi.fn(),
}))

vi.mock('../services/storageService', () => ({
  StorageService: {
    remove,
    removeMany,
    add,
  },
}))

const baseExpenses: Expense[] = [
  { id: 1, date: '2026-05-01', amount: 100, description: 'Rent' },
  { id: 2, date: '2026-05-02', amount: 50, description: 'Food' },
  { id: 3, date: '2026-05-03', amount: 20, description: 'Coffee' },
]

describe('useOptimisticExpenseDelete', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    remove.mockResolvedValue(undefined)
    removeMany.mockResolvedValue(undefined)
    add.mockResolvedValue(1)
  })

  it('hides expense immediately and commits delete after 2 seconds', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const triggerSync = vi.fn()
    const undoHandlers: Array<() => void | Promise<void>> = []
    const showUndoToast = vi.fn((message: string, onUndo: () => void | Promise<void>) => {
      undoHandlers.push(onUndo)
      return message
    })

    const { result } = renderHook(() => {
      const [expenses, setExpenses] = useState(baseExpenses)
      return useOptimisticExpenseDelete({
        expenses,
        setExpenses,
        refreshExpenses,
        triggerSync,
        showUndoToast,
      })
    })

    await act(async () => {
      await result.current.handleDelete(2)
    })

    expect(result.current.visibleExpenses.map((expense) => expense.id)).toEqual([1, 3])
    expect(remove).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(remove).toHaveBeenCalledWith(2)
    expect(triggerSync).toHaveBeenCalledTimes(1)
    expect(refreshExpenses).toHaveBeenCalledTimes(1)
    expect(undoHandlers).toHaveLength(1)
  })

  it('undo before timer prevents remove and restores order', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const triggerSync = vi.fn()
    const undoHandlers: Array<() => void | Promise<void>> = []
    const showUndoToast = vi.fn((_message: string, onUndo: () => void | Promise<void>) => {
      undoHandlers.push(onUndo)
      return 'undo'
    })

    const { result } = renderHook(() => {
      const [expenses, setExpenses] = useState(baseExpenses)
      return useOptimisticExpenseDelete({
        expenses,
        setExpenses,
        refreshExpenses,
        triggerSync,
        showUndoToast,
      })
    })

    await act(async () => {
      await result.current.handleDelete(2)
      await undoHandlers[0]()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200)
    })

    expect(remove).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
    expect(result.current.visibleExpenses.map((expense) => expense.id)).toEqual([1, 2, 3])
  })

  it('undo after timer re-adds expense and triggers sync', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const triggerSync = vi.fn()
    const undoHandlers: Array<() => void | Promise<void>> = []
    const showUndoToast = vi.fn((_message: string, onUndo: () => void | Promise<void>) => {
      undoHandlers.push(onUndo)
      return 'undo'
    })

    const { result } = renderHook(() => {
      const [expenses, setExpenses] = useState(baseExpenses)
      return useOptimisticExpenseDelete({
        expenses,
        setExpenses,
        refreshExpenses,
        triggerSync,
        showUndoToast,
      })
    })

    await act(async () => {
      await result.current.handleDelete(2)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
      await Promise.resolve()
    })

    await act(async () => {
      await undoHandlers[0]()
    })

    expect(remove).toHaveBeenCalledWith(2)
    expect(add).toHaveBeenCalledWith(baseExpenses[1])
    expect(triggerSync).toHaveBeenCalledTimes(2)
    expect(result.current.visibleExpenses.map((expense) => expense.id)).toEqual([1, 2, 3])
  })

  it('bulk delete commits after 2 seconds and undo restores all items', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const triggerSync = vi.fn()
    const undoHandlers: Array<() => void | Promise<void>> = []
    const showUndoToast = vi.fn((_message: string, onUndo: () => void | Promise<void>) => {
      undoHandlers.push(onUndo)
      return 'undo'
    })

    const { result } = renderHook(() => {
      const [expenses, setExpenses] = useState(baseExpenses)
      return useOptimisticExpenseDelete({
        expenses,
        setExpenses,
        refreshExpenses,
        triggerSync,
        showUndoToast,
      })
    })

    await act(async () => {
      await result.current.handleBulkDelete([1, 3])
    })
    expect(result.current.visibleExpenses.map((expense) => expense.id)).toEqual([2])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
      await Promise.resolve()
    })

    await act(async () => {
      await undoHandlers[0]()
    })

    expect(removeMany).toHaveBeenCalledWith([1, 3])
    expect(add).toHaveBeenCalledTimes(2)
    expect(add).toHaveBeenNthCalledWith(1, baseExpenses[0])
    expect(add).toHaveBeenNthCalledWith(2, baseExpenses[2])
    expect(result.current.visibleExpenses.map((expense) => expense.id)).toEqual([1, 2, 3])
  })
})
