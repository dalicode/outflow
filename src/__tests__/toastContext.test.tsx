import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToasts } from '../context/toastContext'

function TriggerToastButton() {
  const { showToast } = useToasts()

  return (
    <button
      type="button"
      onClick={() => {
        showToast({
          message: 'Warning message',
          tone: 'warning',
          actionLabel: 'Review',
          onAction: vi.fn(),
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

  it('uses warning token styling for warning toasts', async () => {
    render(
      <ToastProvider>
        <TriggerToastButton />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show warning toast' }))

    await waitFor(() => {
      expect(screen.getByText('Warning message')).toBeInTheDocument()
    })

    const actionButton = screen.getByRole('button', { name: 'Review' })
    expect(actionButton).toHaveClass('text-theme-warning')
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
    expect(undoAction.closest('.toast-card-action')).not.toBeNull()

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
    window.dispatchEvent(new Event('resize'))

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
    window.dispatchEvent(new Event('resize'))
  })
})
