import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DesktopDropdown from '../components/inputs/DesktopDropdown'

describe('DesktopDropdown', () => {
  it('highlights the first row when opened and selects it with Enter', async () => {
    const onChange = vi.fn()

    render(
      <DesktopDropdown
        value={undefined}
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        placeholder="Select payee"
        emptyMessage="No matches found."
        autoFocus
        onChange={onChange}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    const firstOption = screen.getByRole('button', { name: 'Coffee' })
    expect(firstOption.className).toContain('bg-theme-primary-muted')

    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(1)
    })
  })

  it('highlights the first filtered row while typing and supports arrow navigation', async () => {
    const onChange = vi.fn()

    render(
      <DesktopDropdown
        value={undefined}
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
        ]}
        placeholder="Select payee"
        emptyMessage="No matches found."
        autoFocus
        onChange={onChange}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    fireEvent.change(search, { target: { value: 'g' } })

    const gasOption = screen.getByRole('button', { name: 'Gas' })
    const groceriesOption = screen.getByRole('button', { name: 'Groceries' })

    expect(gasOption.className).toContain('bg-theme-primary-muted')
    expect(groceriesOption.className).not.toContain('bg-theme-primary-muted')

    fireEvent.keyDown(search, { key: 'ArrowDown' })
    expect(groceriesOption.className).toContain('bg-theme-primary-muted')
    expect(gasOption.className).not.toContain('bg-theme-primary-muted')

    fireEvent.keyDown(search, { key: 'ArrowUp' })
    expect(gasOption.className).toContain('bg-theme-primary-muted')
    expect(groceriesOption.className).not.toContain('bg-theme-primary-muted')

    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(3)
    })
  })
})
