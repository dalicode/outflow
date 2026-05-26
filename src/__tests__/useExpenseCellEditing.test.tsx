import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Expense } from '../types'
import { useExpenseCellEditing } from '../features/dashboard/useExpenseCellEditing'

const expenses: Expense[] = [
  { id: 1, date: '2024-06-01', amount: 10, notes: 'Coffee' },
  { id: 2, date: '2024-06-02', amount: 20, notes: 'Groceries' },
  { id: 3, date: '2024-06-03', amount: 30, notes: 'Gas' },
]

describe('useExpenseCellEditing', () => {
  it('moves to the same field on the next row with Enter navigation', () => {
    const { result } = renderHook(() =>
      useExpenseCellEditing({
        expenses,
        onUpdate: vi.fn(),
        isMobile: false,
        selectedIds: new Set<number>(),
        onToggleSelect: vi.fn(),
        setMobileEditExpense: vi.fn(),
        setShowMobileEditModal: vi.fn(),
      }),
    )

    act(() => {
      result.current.startCellEdit(expenses[0], 'amount')
    })

    act(() => {
      result.current.handleEnterNavigation(expenses[0], 'amount', false)
    })

    expect(result.current.editingCell).toEqual({
      expenseId: 2,
      field: 'amount',
    })
  })

  it('moves to the same field on the previous row with Shift+Enter', () => {
    const { result } = renderHook(() =>
      useExpenseCellEditing({
        expenses,
        onUpdate: vi.fn(),
        isMobile: false,
        selectedIds: new Set<number>(),
        onToggleSelect: vi.fn(),
        setMobileEditExpense: vi.fn(),
        setShowMobileEditModal: vi.fn(),
      }),
    )

    act(() => {
      result.current.startCellEdit(expenses[1], 'notes')
    })

    act(() => {
      result.current.handleEnterNavigation(expenses[1], 'notes', true)
    })

    expect(result.current.editingCell).toEqual({
      expenseId: 1,
      field: 'notes',
    })
  })

  it('closes edit mode when Enter navigation runs past the table bounds', () => {
    const { result } = renderHook(() =>
      useExpenseCellEditing({
        expenses,
        onUpdate: vi.fn(),
        isMobile: false,
        selectedIds: new Set<number>(),
        onToggleSelect: vi.fn(),
        setMobileEditExpense: vi.fn(),
        setShowMobileEditModal: vi.fn(),
      }),
    )

    act(() => {
      result.current.startCellEdit(expenses[2], 'date')
    })

    act(() => {
      result.current.handleEnterNavigation(expenses[2], 'date', false)
    })

    expect(result.current.editingCell).toBeNull()
  })

  it('blocks date editing for split child expenses', () => {
    const splitChild: Expense = {
      id: 4,
      splitId: 12,
      date: '2024-06-04',
      amount: 12,
      notes: 'Split child',
    }

    const { result } = renderHook(() =>
      useExpenseCellEditing({
        expenses: [...expenses, splitChild],
        onUpdate: vi.fn(),
        isMobile: false,
        selectedIds: new Set<number>(),
        onToggleSelect: vi.fn(),
        setMobileEditExpense: vi.fn(),
        setShowMobileEditModal: vi.fn(),
      }),
    )

    act(() => {
      result.current.startCellEdit(splitChild, 'date')
    })

    expect(result.current.editingCell).toBeNull()
    expect(result.current.isFieldEditable(splitChild, 'date')).toBe(false)
  })

  it('routes split child amount editing through the modal editor', () => {
    const splitChild: Expense = {
      id: 4,
      splitId: 12,
      date: '2024-06-04',
      amount: 12,
      notes: 'Split child',
    }
    const setMobileEditExpense = vi.fn()
    const setShowMobileEditModal = vi.fn()

    const { result } = renderHook(() =>
      useExpenseCellEditing({
        expenses: [...expenses, splitChild],
        onUpdate: vi.fn(),
        isMobile: false,
        selectedIds: new Set<number>(),
        onToggleSelect: vi.fn(),
        setMobileEditExpense,
        setShowMobileEditModal,
      }),
    )

    act(() => {
      result.current.startCellEdit(splitChild, 'amount')
    })

    expect(result.current.editingCell).toBeNull()
    expect(result.current.isFieldEditable(splitChild, 'amount')).toBe(false)
    expect(setMobileEditExpense).toHaveBeenCalledWith(splitChild)
    expect(setShowMobileEditModal).toHaveBeenCalledWith(true)
  })

  it('clears the active inline editor before opening split child amount modal', () => {
    const splitChild: Expense = {
      id: 4,
      splitId: 12,
      date: '2024-06-04',
      amount: 12,
      notes: 'Split child',
    }
    const setMobileEditExpense = vi.fn()
    const setShowMobileEditModal = vi.fn()
    const input = document.createElement('input')
    document.body.appendChild(input)

    const { result } = renderHook(() =>
      useExpenseCellEditing({
        expenses: [...expenses, splitChild],
        onUpdate: vi.fn(),
        isMobile: false,
        selectedIds: new Set<number>(),
        onToggleSelect: vi.fn(),
        setMobileEditExpense,
        setShowMobileEditModal,
      }),
    )

    act(() => {
      result.current.startCellEdit(expenses[0], 'notes')
    })
    input.focus()

    act(() => {
      result.current.startCellEdit(splitChild, 'amount')
    })

    expect(result.current.editingCell).toBeNull()
    expect(document.activeElement).not.toBe(input)
    expect(setMobileEditExpense).toHaveBeenCalledWith(splitChild)
    expect(setShowMobileEditModal).toHaveBeenCalledWith(true)

    input.remove()
  })

  it('includes tags in desktop Tab navigation order', async () => {
    const { result } = renderHook(() =>
      useExpenseCellEditing({
        expenses,
        onUpdate: vi.fn(),
        isMobile: false,
        selectedIds: new Set<number>(),
        onToggleSelect: vi.fn(),
        setMobileEditExpense: vi.fn(),
        setShowMobileEditModal: vi.fn(),
      }),
    )

    act(() => {
      result.current.startCellEdit(expenses[0], 'notes')
    })
    act(() => {
      result.current.handleTabNavigation(expenses[0], 'notes', false)
    })
    await waitFor(() => {
      expect(result.current.editingCell).toEqual({
        expenseId: 1,
        field: 'tags',
      })
    })

    act(() => {
      result.current.handleTabNavigation(expenses[0], 'tags', false)
    })
    await waitFor(() => {
      expect(result.current.editingCell).toEqual({
        expenseId: 1,
        field: 'amount',
      })
    })
  })
})
