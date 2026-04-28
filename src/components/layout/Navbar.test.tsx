import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from './Navbar'

describe('Navbar', () => {
  it('renders navigation links in desktop sidebar', () => {
    render(
      <MemoryRouter>
        <Navbar onAddExpense={vi.fn()} />
      </MemoryRouter>,
    )

    const sidebar = document.querySelector('aside')!
    expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument()
    expect(within(sidebar).getByText('Summary')).toBeInTheDocument()
    expect(within(sidebar).getByText('Analytics')).toBeInTheDocument()
    expect(within(sidebar).getByText('Settings')).toBeInTheDocument()
  })

  it('calls onAddExpense when desktop Add button is clicked', () => {
    const onAddExpense = vi.fn()
    render(
      <MemoryRouter>
        <Navbar onAddExpense={onAddExpense} />
      </MemoryRouter>,
    )

    const sidebar = document.querySelector('aside')!
    fireEvent.click(within(sidebar).getByLabelText('Add expense'))
    expect(onAddExpense).toHaveBeenCalledTimes(1)
  })

  it('renders sign out button when onSignOut provided', () => {
    render(
      <MemoryRouter>
        <Navbar onAddExpense={vi.fn()} onSignOut={vi.fn()} userEmail="test@example.com" />
      </MemoryRouter>,
    )

    const sidebar = document.querySelector('aside')!
    expect(within(sidebar).getByText('Sign out')).toBeInTheDocument()
    expect(within(sidebar).getByText('test@example.com')).toBeInTheDocument()
  })

  it('calls onSignOut when sign out clicked', () => {
    const onSignOut = vi.fn()
    render(
      <MemoryRouter>
        <Navbar onAddExpense={vi.fn()} onSignOut={onSignOut} />
      </MemoryRouter>,
    )

    const sidebar = document.querySelector('aside')!
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
    const analyticsLink = within(sidebar).getByText('Analytics').closest('a')
    expect(analyticsLink).toHaveClass('text-theme-primary')
  })

  it('renders syncDot when provided', () => {
    render(
      <MemoryRouter>
        <Navbar onAddExpense={vi.fn()} syncDot={<span data-testid="sync">syncing</span>} />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('sync')).toBeInTheDocument()
  })

  it('collapses and expands sidebar', () => {
    render(
      <MemoryRouter>
        <Navbar onAddExpense={vi.fn()} />
      </MemoryRouter>,
    )

    const sidebar = document.querySelector('aside')!
    // Initially expanded - desktop link text is visible
    expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument()

    const collapseButton = within(sidebar).getByTitle('Collapse')
    fireEvent.click(collapseButton)

    // After collapse, desktop sidebar link text should be hidden
    expect(within(sidebar).queryByText('Dashboard')).not.toBeInTheDocument()
  })
})
