import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

describe('ToastContext', () => {
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
})
