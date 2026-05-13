import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Expense } from '../types'
import { useExpenseCellEditing } from '../features/dashboard/useExpenseCellEditing'

const expenses: Expense[] = [
  { id: 1, date: '2024-06-01', amount: 10, description: 'Coffee' },
  { id: 2, date: '2024-06-02', amount: 20, description: 'Groceries' },
  { id: 3, date: '2024-06-03', amount: 30, description: 'Gas' },
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
      result.current.startCellEdit(expenses[1], 'description')
    })

    act(() => {
      result.current.handleEnterNavigation(expenses[1], 'description', true)
    })

    expect(result.current.editingCell).toEqual({
      expenseId: 1,
      field: 'description',
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
})
