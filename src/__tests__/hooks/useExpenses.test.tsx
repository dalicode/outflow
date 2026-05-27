import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Expense } from '@/types'
import { useExpenses } from '@/hooks/useExpenses'

const liveExpenseStore = vi.hoisted(() => {
  let value: Expense[] | undefined = []
  const listeners = new Set<() => void>()

  return {
    get: () => value,
    set: (nextValue: Expense[] | undefined) => {
      value = nextValue
      listeners.forEach((listener) => {
        listener()
      })
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
})

const { getAll } = vi.hoisted(() => ({
  getAll: vi.fn(async () => liveExpenseStore.get() ?? []),
}))

vi.mock('dexie-react-hooks', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useLiveQuery: () =>
      useSyncExternalStore(liveExpenseStore.subscribe, liveExpenseStore.get, liveExpenseStore.get),
  }
})

vi.mock('@/services/repositories/expenseRepository', () => ({
  getAll,
}))

function ExpenseListConsumer() {
  const { expenses } = useExpenses()

  return (
    <ul>
      {expenses.map((expense) => (
        <li key={expense.id}>
          {expense.notes} - {expense.amount}
        </li>
      ))}
    </ul>
  )
}

describe('useExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    liveExpenseStore.set([])
  })

  it('updates reactively when local expense rows change', async () => {
    const firstExpense: Expense = {
      id: 1,
      date: '2026-05-01',
      amount: 20,
      notes: 'Coffee',
    }
    const secondExpense: Expense = {
      id: 2,
      date: '2026-05-02',
      amount: 45,
      notes: 'Groceries',
    }

    liveExpenseStore.set([firstExpense])
    const { result } = renderHook(() => useExpenses())

    await waitFor(() => {
      expect(result.current.expenses).toEqual([firstExpense])
    })

    act(() => {
      liveExpenseStore.set([firstExpense, secondExpense])
    })

    await waitFor(() => {
      expect(result.current.expenses).toEqual([firstExpense, secondExpense])
    })
  })

  it('updates visible UI after a local expense write without remounting', async () => {
    const firstExpense: Expense = {
      id: 1,
      date: '2026-05-01',
      amount: 20,
      notes: 'Coffee',
    }
    const updatedExpense: Expense = {
      ...firstExpense,
      amount: 24,
      notes: 'Coffee beans',
    }

    liveExpenseStore.set([firstExpense])
    render(<ExpenseListConsumer />)

    await screen.findByText('Coffee - 20')

    act(() => {
      liveExpenseStore.set([updatedExpense])
    })

    await waitFor(() => {
      expect(screen.getByText('Coffee beans - 24')).toBeInTheDocument()
    })
    expect(screen.queryByText('Coffee - 20')).not.toBeInTheDocument()
  })

  it('keeps optimistic updates until live DB catches up, then reconciles', async () => {
    const firstExpense: Expense = {
      id: 1,
      date: '2026-05-01',
      amount: 20,
      notes: 'Coffee',
    }
    const optimisticExpense: Expense = {
      id: 2,
      date: '2026-05-03',
      amount: 70,
      notes: 'Transit pass',
    }

    liveExpenseStore.set([firstExpense])
    const { result } = renderHook(() => useExpenses())

    await waitFor(() => {
      expect(result.current.expenses).toEqual([firstExpense])
    })

    act(() => {
      result.current.setExpenses((previous) => [...previous, optimisticExpense])
    })

    expect(result.current.expenses).toEqual([firstExpense, optimisticExpense])

    act(() => {
      liveExpenseStore.set([firstExpense])
    })

    expect(result.current.expenses).toEqual([firstExpense, optimisticExpense])

    act(() => {
      liveExpenseStore.set([firstExpense, optimisticExpense])
    })

    await waitFor(() => {
      expect(result.current.expenses).toEqual([firstExpense, optimisticExpense])
    })

    const reconciledExpense: Expense = {
      ...optimisticExpense,
      amount: 75,
    }
    act(() => {
      liveExpenseStore.set([firstExpense, reconciledExpense])
    })

    await waitFor(() => {
      expect(result.current.expenses).toEqual([firstExpense, reconciledExpense])
    })
  })
})
