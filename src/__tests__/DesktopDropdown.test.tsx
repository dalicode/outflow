import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DesktopDropdown from '../components/inputs/DesktopDropdown'

describe('DesktopDropdown', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it('mirrors above-opening order and highlights the recent item closest to the input', async () => {
    const onChange = vi.fn()

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 40,
      y: 520,
      top: 520,
      bottom: 560,
      left: 40,
      right: 320,
      width: 280,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect)
    vi.stubGlobal('innerHeight', 620)

    render(
      <DesktopDropdown
        value={undefined}
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
        ]}
        recentOptions={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        placeholder="Select payee"
        emptyMessage="No matches found."
        autoFocus
        onChange={onChange}
      />,
    )

    await screen.findByPlaceholderText('Search...')

    const coffeeOption = screen.getByRole('button', { name: 'Coffee' })
    const groceriesOption = screen.getByRole('button', { name: 'Groceries' })
    expect(coffeeOption.className).toContain('bg-theme-primary-muted')
    expect(groceriesOption.className).not.toContain('bg-theme-primary-muted')

    const content = coffeeOption.parentElement
    expect(content?.textContent).toMatch(/Gas.*All.*Groceries.*Coffee.*Recent/)
  })
})
