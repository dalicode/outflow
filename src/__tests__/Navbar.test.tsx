import { describe, it, expect, vi } from 'vitest'
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
    expect(within(sidebar).getByText('Summary')).toBeInTheDocument()
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
})
