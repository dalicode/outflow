import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

function renderNavbar(props: Parameters<typeof Navbar>[0]) {
  return render(
    <MemoryRouter>
      <Navbar {...props} />
    </MemoryRouter>,
  )
}

describe('Navbar', () => {
  it('renders navigation links in desktop sidebar', () => {
    renderNavbar({ onAddExpense: vi.fn() })

    const sidebar = document.querySelector('aside')!
    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument()
    expect(within(sidebar).getByText('Budget')).toBeInTheDocument()
    expect(within(sidebar).getByText('Analytics')).toBeInTheDocument()
    expect(within(sidebar).getByText('Settings')).toBeInTheDocument()
  })

  it('calls onAddExpense when desktop Add button is clicked', () => {
    const onAddExpense = vi.fn()
    renderNavbar({ onAddExpense })

    const sidebar = document.querySelector('aside')!
    fireEvent.click(within(sidebar).getByLabelText('Add expense'))
    expect(onAddExpense).toHaveBeenCalledTimes(1)
  })

  it('renders sign out button when onSignOut provided', () => {
    renderNavbar({ onAddExpense: vi.fn(), onSignOut: vi.fn(), userEmail: 'test@example.com' })

    const sidebar = document.querySelector('aside')!
    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    expect(within(sidebar).getByText('Sign out')).toBeInTheDocument()
    expect(within(sidebar).getByText('test@example.com')).toBeInTheDocument()
  })

  it('calls onSignOut when sign out clicked', () => {
    const onSignOut = vi.fn()
    renderNavbar({ onAddExpense: vi.fn(), onSignOut })

    const sidebar = document.querySelector('aside')!
    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    fireEvent.click(within(sidebar).getByText('Sign out'))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('marks Dashboard as active on home route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar onAddExpense={vi.fn()} />
      </MemoryRouter>,
    )

    const sidebar = document.querySelector('aside')!
    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    const dashboardLink = within(sidebar).getByText('Dashboard').closest('a')
    expect(dashboardLink).toHaveClass('text-theme-primary')
  })

  it('marks Analytics as active on /analytics', () => {
    render(
      <MemoryRouter initialEntries={['/analytics']}>
        <Navbar onAddExpense={vi.fn()} />
      </MemoryRouter>,
    )

    const sidebar = document.querySelector('aside')!
    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    const analyticsLink = within(sidebar).getByText('Analytics').closest('a')
    expect(analyticsLink).toHaveClass('text-theme-primary')
  })

  it('renders syncDot when provided', () => {
    renderNavbar({ onAddExpense: vi.fn(), syncDot: <span data-testid="sync">syncing</span> })

    expect(screen.getByTestId('sync')).toBeInTheDocument()
  })

  it('expands and collapses sidebar', () => {
    renderNavbar({ onAddExpense: vi.fn() })

    const sidebar = document.querySelector('aside')!
    // Initially collapsed - desktop link text is hidden
    expect(within(sidebar).queryByText('Dashboard')).not.toBeInTheDocument()

    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    // After expand, desktop sidebar link text should be visible
    expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument()

    const collapseButton = within(sidebar).getByTitle('Collapse')
    fireEvent.click(collapseButton)

    // After collapse, text hidden again
    expect(within(sidebar).queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('toggle buttons have hover-only opacity classes', () => {
    renderNavbar({ onAddExpense: vi.fn() })

    const sidebar = document.querySelector('aside')!
    const expandButton = within(sidebar).getByTitle('Expand')
    expect(expandButton).toHaveClass('opacity-0')
    expect(expandButton).toHaveClass('group-hover:opacity-100')

    fireEvent.click(expandButton)

    const collapseButton = within(sidebar).getByTitle('Collapse')
    expect(collapseButton).toHaveClass('opacity-0')
    expect(collapseButton).toHaveClass('group-hover:opacity-100')
  })

  it('keeps the pill and one-row states drag-only, and lets the expanded state collapse back to one row on click', () => {
    renderNavbar({ onAddExpense: vi.fn() })
    const mobileNav = document.body.querySelector('.mobile-nav-container')
    const mobileWrapper = document.body.querySelector('div[style*="--mobile-nav-wrapper-height"]')
    const dragSurface = () => document.body.querySelector('.mobile-nav-container') as HTMLElement

    // Starts at stage 1 (one row)
    expect(mobileNav).toHaveAttribute('data-stage', '1')
    expect(mobileWrapper).toHaveStyle({
      '--mobile-nav-height': '88px',
      '--mobile-nav-wrapper-height': '136px',
      '--mobile-nav-overscan': '48px',
      '--mobile-nav-collapsed-height': '76px',
    })
    expect(screen.getByLabelText('Expand more')).toBeInTheDocument()

    // Click at stage 1 does nothing
    fireEvent.click(screen.getByLabelText('Expand more'))
    expect(mobileNav).toHaveAttribute('data-stage', '1')
    expect(screen.getByLabelText('Expand more')).toBeInTheDocument()

    // Drag up anywhere on the bar: 1 → 2
    fireEvent.pointerDown(dragSurface(), { clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(dragSurface(), { clientY: 80, pointerId: 1 })
    fireEvent.pointerUp(dragSurface(), { clientY: 80, pointerId: 1 })
    expect(mobileNav).toHaveAttribute('data-stage', '2')
    expect(screen.getByLabelText('Collapse navigation')).toBeInTheDocument()

    // Click at stage 2 tucks back to the default one-row state
    const collapseHandle = screen.getByLabelText('Collapse navigation')
    fireEvent.pointerDown(collapseHandle, { clientY: 80, pointerId: 1 })
    fireEvent.click(collapseHandle)
    expect(mobileNav).toHaveAttribute('data-stage', '1')
    expect(screen.getByLabelText('Expand more')).toBeInTheDocument()

    // Stage 0 pill also ignores clicks
    fireEvent.pointerDown(screen.getByLabelText('Expand more'), { clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(screen.getByLabelText('Expand more'), { clientY: 280, pointerId: 1 })
    fireEvent.pointerUp(screen.getByLabelText('Expand more'), { clientY: 280, pointerId: 1 })
    expect(mobileNav).toHaveAttribute('data-stage', '0')
    fireEvent.click(screen.getByLabelText('Expand navigation'))
    expect(mobileNav).toHaveAttribute('data-stage', '0')
  })

  it('expands and collapses mobile navigation with a vertical drag', () => {
    renderNavbar({ onAddExpense: vi.fn() })
    const mobileNav = document.body.querySelector('.mobile-nav-container')
    const dragSurface = () => document.body.querySelector('.mobile-nav-container') as HTMLElement

    // Start at stage 1
    expect(mobileNav).toHaveAttribute('data-stage', '1')

    // Drag up to expand to stage 2
    fireEvent.pointerDown(dragSurface(), { clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(dragSurface(), { clientY: 80, pointerId: 1 })
    fireEvent.pointerUp(dragSurface(), { clientY: 80, pointerId: 1 })

    expect(mobileNav).toHaveAttribute('data-stage', '2')
    expect(screen.getByLabelText('Collapse navigation')).toBeInTheDocument()

    // Drag down to collapse to stage 0
    fireEvent.pointerDown(dragSurface(), { clientY: 80, pointerId: 1 })
    fireEvent.pointerMove(dragSurface(), { clientY: 260, pointerId: 1 })
    fireEvent.pointerUp(dragSurface(), { clientY: 260, pointerId: 1 })

    expect(mobileNav).toHaveAttribute('data-stage', '0')
    expect(screen.getByLabelText('Expand navigation')).toBeInTheDocument()
  })

  it('collapses back to the default one-row state on click after drag-expanding', () => {
    renderNavbar({ onAddExpense: vi.fn() })
    const mobileNav = document.body.querySelector('.mobile-nav-container')
    const dragSurface = () => document.body.querySelector('.mobile-nav-container') as HTMLElement

    // Drag to stage 2
    fireEvent.pointerDown(dragSurface(), { clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(dragSurface(), { clientY: 80, pointerId: 1 })
    fireEvent.pointerUp(dragSurface(), { clientY: 80, pointerId: 1 })

    expect(mobileNav).toHaveAttribute('data-stage', '2')

    // Click to tuck back to stage 1
    const collapseHandle = screen.getByLabelText('Collapse navigation')
    fireEvent.pointerDown(collapseHandle, { clientY: 80, pointerId: 1 })
    fireEvent.click(collapseHandle)

    expect(mobileNav).toHaveAttribute('data-stage', '1')
    expect(screen.getByLabelText('Expand more')).toBeInTheDocument()
  })

  it('auto-collapses to stage-0 pill on scroll down and restores on scroll up', () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    )

    const { rerender } = render(
      <Navbar onAddExpense={vi.fn()} scrollDirection={null} isScrolling={false} />,
      { wrapper: Wrapper },
    )

    const getMobileNavContainer = () =>
      document.body.querySelector('.mobile-nav-container')
    const getMobileNav = () =>
      document.body.querySelector('nav.mobile-nav-bounce')

    // Start at stage 1
    expect(getMobileNavContainer()).toHaveAttribute('data-stage', '1')

    // Drag to stage 2
    fireEvent.pointerDown(getMobileNavContainer() as HTMLElement, { clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(getMobileNavContainer() as HTMLElement, { clientY: 80, pointerId: 1 })
    fireEvent.pointerUp(getMobileNavContainer() as HTMLElement, { clientY: 80, pointerId: 1 })

    expect(getMobileNavContainer()).toHaveAttribute('data-stage', '2')

    // While still scrolling, nav stays at stage 2
    rerender(
      <Navbar onAddExpense={vi.fn()} scrollDirection="down" isScrolling={true} />,
    )
    expect(getMobileNavContainer()).toHaveAttribute('data-stage', '2')

    // Scroll stops → auto-collapse to stage 0
    rerender(
      <Navbar onAddExpense={vi.fn()} scrollDirection="down" isScrolling={false} />,
    )
    expect(getMobileNavContainer()).toHaveAttribute('data-stage', '0')
    expect(getMobileNav()).toHaveClass('translate-y-[calc(100%-18px)]')

    // While scrolling up, stays at stage 0
    rerender(
      <Navbar onAddExpense={vi.fn()} scrollDirection="up" isScrolling={true} />,
    )
    expect(getMobileNavContainer()).toHaveAttribute('data-stage', '0')

    // Scroll up stops → restore to stage 1
    rerender(
      <Navbar onAddExpense={vi.fn()} scrollDirection="up" isScrolling={false} />,
    )
    expect(getMobileNavContainer()).toHaveAttribute('data-stage', '1')
    expect(getMobileNav()).not.toHaveClass('translate-y-[calc(100%-18px)]')
  })

  it('keeps the pill drag-only after auto-collapse', () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    )

    const { rerender } = render(
      <Navbar onAddExpense={vi.fn()} scrollDirection={null} isScrolling={false} />,
      { wrapper: Wrapper },
    )

    const getMobileNavContainer = () =>
      document.body.querySelector('.mobile-nav-container')
    const getMobileNav = () =>
      document.body.querySelector('nav.mobile-nav-bounce')

    rerender(
      <Navbar onAddExpense={vi.fn()} scrollDirection="down" isScrolling={false} />,
    )

    expect(getMobileNavContainer()).toHaveAttribute('data-stage', '0')
    expect(getMobileNav()).toHaveClass('translate-y-[calc(100%-18px)]')

    fireEvent.click(screen.getByLabelText('Expand navigation'))
    expect(getMobileNavContainer()).toHaveAttribute('data-stage', '0')
    expect(getMobileNav()).toHaveClass('translate-y-[calc(100%-18px)]')

    fireEvent.pointerDown(getMobileNavContainer() as HTMLElement, { clientY: 220, pointerId: 1 })
    fireEvent.pointerMove(getMobileNavContainer() as HTMLElement, { clientY: 90, pointerId: 1 })
    fireEvent.pointerUp(getMobileNavContainer() as HTMLElement, { clientY: 90, pointerId: 1 })

    expect(getMobileNavContainer()).toHaveAttribute('data-stage', '2')
    expect(getMobileNav()).not.toHaveClass('translate-y-[calc(100%-18px)]')
  })

  it('still lets icon taps work when the bar is not dragged', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Navbar onAddExpense={vi.fn()} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByLabelText('Budget'))

    const mobileBudgetLink = screen
      .getAllByTestId('nav-summary')
      .find((element) => element.getAttribute('aria-label') === 'Budget')

    expect(mobileBudgetLink).toHaveAttribute('aria-current', 'page')
  })
})
