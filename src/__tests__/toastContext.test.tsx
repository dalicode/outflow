import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToasts } from '../context/toastContext'

function TriggerToastButton({ onAction = vi.fn() }: { onAction?: () => void }) {
  const { showToast } = useToasts()

  return (
    <button
      type="button"
      onClick={() => {
        showToast({
          message: 'Warning message',
          tone: 'warning',
          actionLabel: 'Review',
          onAction,
        })
      }}
    >
      Show warning toast
    </button>
  )
}

function TriggerUndoToastButton() {
  const { showUndoToast } = useToasts()

  return (
    <button
      type="button"
      onClick={() => {
        showUndoToast('Undo message', () => undefined)
      }}
    >
      Show undo toast
    </button>
  )
}

function TriggerRoutineToastButton() {
  const { showToast } = useToasts()

  return (
    <button
      type="button"
      onClick={() => {
        showToast({
          message: 'Routine message',
          tone: 'default',
        })
      }}
    >
      Show routine toast
    </button>
  )
}

describe('ToastContext', () => {
  afterEach(() => {
    try {
      vi.runOnlyPendingTimers()
    } catch {
      // noop when fake timers are not active
    }
    vi.useRealTimers()
  })

  it('renders warning toast actions and runs them when clicked', async () => {
    const onAction = vi.fn()

    render(
      <ToastProvider>
        <TriggerToastButton onAction={onAction} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show warning toast' }))

    await waitFor(() => {
      expect(screen.getByText('Warning message')).toBeInTheDocument()
    })

    const actionButton = screen.getByRole('button', { name: 'Review' })
    fireEvent.click(actionButton)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('marks undo toasts as undo style and keeps them visible longer', async () => {
    vi.useFakeTimers()

    render(
      <ToastProvider>
        <TriggerUndoToastButton />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show undo toast' }))
    await act(async () => {
      await Promise.resolve()
    })

    const undoAction = screen.getByRole('button', { name: 'Undo' })
    expect(undoAction).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100)
    })
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('keeps an active undo toast visible on mobile when routine toasts are added', async () => {
    const originalWidth = window.innerWidth
    window.innerWidth = 375
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })

    render(
      <ToastProvider>
        <TriggerUndoToastButton />
        <TriggerRoutineToastButton />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show undo toast' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show routine toast' }))

    await waitFor(() => {
      expect(screen.getByText('Undo message')).toBeInTheDocument()
    })
    expect(screen.queryByText('Routine message')).not.toBeInTheDocument()

    window.innerWidth = originalWidth
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })
  })
})
