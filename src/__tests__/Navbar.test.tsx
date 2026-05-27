import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Navbar from '../app/layout/Navbar'

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

    const sidebar = document.querySelector('aside') as HTMLElement
    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument()
    expect(within(sidebar).getByText('Budget')).toBeInTheDocument()
    expect(within(sidebar).getByText('Analytics')).toBeInTheDocument()
    expect(within(sidebar).getByText('Tags')).toBeInTheDocument()
    expect(within(sidebar).getByText('Settings')).toBeInTheDocument()
  })

  it('calls onAddExpense when desktop Add button is clicked', () => {
    const onAddExpense = vi.fn()
    renderNavbar({ onAddExpense })

    const sidebar = document.querySelector('aside') as HTMLElement
    fireEvent.click(within(sidebar).getByLabelText('Add expense'))
    expect(onAddExpense).toHaveBeenCalledTimes(1)
  })

  it('renders sign out button when onSignOut provided', () => {
    renderNavbar({ onAddExpense: vi.fn(), onSignOut: vi.fn(), userEmail: 'test@example.com' })

    const sidebar = document.querySelector('aside') as HTMLElement
    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    expect(within(sidebar).getByText('Sign out')).toBeInTheDocument()
    expect(within(sidebar).getByTitle('test@example.com')).toBeInTheDocument()
  })

  it('shows the expanded cloud sync status label for signed-in users', () => {
    renderNavbar({
      onAddExpense: vi.fn(),
      onSignOut: vi.fn(),
      userEmail: 'test@example.com',
      syncStatus: 'idle',
    })

    const sidebar = document.querySelector('aside') as HTMLElement
    fireEvent.click(within(sidebar).getByTitle('Expand'))

    expect(within(sidebar).getByLabelText('Cloud synced')).toBeInTheDocument()
    expect(within(sidebar).getByText('Cloud synced')).toBeInTheDocument()
  })

  it('calls onSignOut when sign out clicked', () => {
    const onSignOut = vi.fn()
    renderNavbar({ onAddExpense: vi.fn(), onSignOut })

    const sidebar = document.querySelector('aside') as HTMLElement
    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    fireEvent.click(within(sidebar).getByText('Sign out'))
    expect(onSignOut).not.toHaveBeenCalled()
    expect(screen.getByText('Sign out?')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('marks Dashboard as active on home route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar onAddExpense={vi.fn()} />
      </MemoryRouter>,
    )

    const sidebar = document.querySelector('aside') as HTMLElement
    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    const dashboardLink = within(sidebar).getByText('Dashboard').closest('a')
    expect(dashboardLink).toHaveAttribute('aria-current', 'page')
  })

  it('marks Analytics as active on /analytics', () => {
    render(
      <MemoryRouter initialEntries={['/analytics']}>
        <Navbar onAddExpense={vi.fn()} />
      </MemoryRouter>,
    )

    const sidebar = document.querySelector('aside') as HTMLElement
    const expandButton = within(sidebar).getByTitle('Expand')
    fireEvent.click(expandButton)

    const analyticsLink = within(sidebar).getByText('Analytics').closest('a')
    expect(analyticsLink).toHaveAttribute('aria-current', 'page')
  })

  it('expands and collapses sidebar', () => {
    renderNavbar({ onAddExpense: vi.fn() })

    const sidebar = document.querySelector('aside') as HTMLElement
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

  it('toggles mobile nav visibility with click and drag', () => {
    renderNavbar({ onAddExpense: vi.fn() })
    const dragSurface = () => document.body.querySelector('.mobile-nav-container') as HTMLElement

    // Initially, expand handle is present
    expect(screen.getByLabelText('Expand navigation')).toBeInTheDocument()

    // Click to expand
    fireEvent.click(screen.getByLabelText('Expand navigation'))
    expect(screen.getByLabelText('Collapse navigation')).toBeInTheDocument()

    // Click to collapse
    const collapseHandle = screen.getByLabelText('Collapse navigation')
    fireEvent.pointerDown(collapseHandle, { clientY: 80, pointerId: 1 })
    fireEvent.click(collapseHandle)
    expect(screen.getByLabelText('Expand navigation')).toBeInTheDocument()

    // Drag up to expand
    fireEvent.pointerDown(dragSurface(), { clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(dragSurface(), { clientY: 80, pointerId: 1 })
    fireEvent.pointerUp(dragSurface(), { clientY: 80, pointerId: 1 })
    expect(screen.getByLabelText('Collapse navigation')).toBeInTheDocument()

    // Drag down to collapse
    fireEvent.pointerDown(dragSurface(), { clientY: 80, pointerId: 1 })
    fireEvent.pointerMove(dragSurface(), { clientY: 260, pointerId: 1 })
    fireEvent.pointerUp(dragSurface(), { clientY: 260, pointerId: 1 })
    expect(screen.getByLabelText('Expand navigation')).toBeInTheDocument()
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

  it('renders four evenly grouped secondary mobile nav destinations', () => {
    renderNavbar({ onAddExpense: vi.fn() })

    expect(screen.getByLabelText('Analytics')).toBeInTheDocument()
    expect(screen.getByLabelText('Payees')).toBeInTheDocument()
    expect(screen.getByLabelText('Tags')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
  })
})
