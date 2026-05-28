import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScrollablePage from '@/app/ScrollablePage'

vi.mock('@/components/ui/PullToRefreshContainer', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & { onRefresh: () => Promise<void> }
    >(function PullToRefreshContainerMock({ children, onRefresh: _onRefresh, ...props }, ref) {
      return (
        <div ref={ref} data-testid="route-scroller" {...props}>
          {children}
        </div>
      )
    }),
  }
})

describe('ScrollablePage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses hidden-until-scroll scrollbar behavior on mobile routes', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 375,
      configurable: true,
      writable: true,
    })

    render(
      <ScrollablePage onRefresh={async () => undefined}>
        <div>content</div>
      </ScrollablePage>,
    )

    const routeScroller = screen.getByTestId('route-scroller')
    expect(routeScroller.className).toContain('scrollbar-auto-hide')
    expect(routeScroller.className).not.toContain('is-scrolling')

    fireEvent.scroll(routeScroller)
    expect(routeScroller.className).toContain('is-scrolling')

    act(() => {
      vi.advanceTimersByTime(801)
    })

    expect(routeScroller.className).not.toContain('is-scrolling')
  })
})
