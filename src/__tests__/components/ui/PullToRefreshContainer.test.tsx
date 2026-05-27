import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Modal from '@/components/ui/Modal'
import PullToRefreshContainer from '@/components/ui/PullToRefreshContainer'

vi.mock('@/hooks/useHaptics', () => ({
  useHaptics: () => ({
    selection: vi.fn(),
    light: vi.fn(),
    medium: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}))

function armPullToRefresh(container: HTMLElement) {
  fireEvent.touchStart(container, {
    touches: [{ clientX: 0, clientY: 100 }],
  })

  fireEvent.touchMove(container, {
    touches: [{ clientX: 0, clientY: 220 }],
    cancelable: true,
  })
}

describe('PullToRefreshContainer', () => {
  it('shows release guidance when armed', () => {
    render(
      <PullToRefreshContainer onRefresh={async () => undefined}>
        <div>content</div>
      </PullToRefreshContainer>,
    )

    const container = document.querySelector('[aria-busy]') as HTMLElement
    armPullToRefresh(container)

    const releaseTextNodes = screen.getAllByText('Release to update')
    expect(releaseTextNodes).toHaveLength(1)
  })

  it('does not render inline success text after refresh completion', async () => {
    vi.useFakeTimers()

    render(
      <PullToRefreshContainer onRefresh={async () => undefined}>
        <div>content</div>
      </PullToRefreshContainer>,
    )

    const container = document.querySelector('[aria-busy]') as HTMLElement
    armPullToRefresh(container)
    await act(async () => {
      fireEvent.touchEnd(container)
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.queryByText('Updated just now')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.queryByText('Updated just now')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('hides spinner and refreshing text immediately after release while refresh runs', async () => {
    let resolveRefresh: (() => void) | null = null
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve
        }),
    )

    render(
      <PullToRefreshContainer onRefresh={onRefresh}>
        <div>content</div>
      </PullToRefreshContainer>,
    )

    const container = document.querySelector('[aria-busy]') as HTMLElement
    armPullToRefresh(container)

    await act(async () => {
      fireEvent.touchEnd(container)
      await Promise.resolve()
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Refreshing')).not.toBeInTheDocument()

    await act(async () => {
      resolveRefresh?.()
      await Promise.resolve()
    })
  })

  it('does not render inline error text when refresh fails', async () => {
    vi.useFakeTimers()

    render(
      <PullToRefreshContainer onRefresh={async () => Promise.reject(new Error('fail'))}>
        <div>content</div>
      </PullToRefreshContainer>,
    )

    const container = document.querySelector('[aria-busy]') as HTMLElement
    armPullToRefresh(container)
    await act(async () => {
      fireEvent.touchEnd(container)
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.queryByText("Couldn't refresh")).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.queryByText("Couldn't refresh")).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('does not arm pull to refresh while a modal is open', () => {
    render(
      <>
        <PullToRefreshContainer onRefresh={async () => undefined}>
          <div>content</div>
        </PullToRefreshContainer>
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          Modal Content
        </Modal>
      </>,
    )

    const container = document.querySelector('[aria-busy]') as HTMLElement
    armPullToRefresh(container)

    expect(screen.queryByText('Release to update')).not.toBeInTheDocument()
  })
})
