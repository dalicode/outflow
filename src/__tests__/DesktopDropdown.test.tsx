import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DesktopDropdown from '../components/inputs/DesktopDropdown'

describe('DesktopDropdown', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not auto-highlight on open and selects with ArrowDown + Enter', async () => {
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
    const secondOption = screen.getByRole('button', { name: 'Groceries' })
    expect(firstOption.className).not.toContain('bg-theme-primary-muted')
    expect(secondOption.className).not.toContain('bg-theme-primary-muted')

    fireEvent.keyDown(search, { key: 'ArrowDown' })
    await waitFor(() => {
      expect(firstOption.className).toContain('bg-theme-primary-muted')
    })

    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(1)
    })
  })

  it('auto-highlights the closest match on type and supports arrow navigation', async () => {
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
    await waitFor(() => {
      expect(groceriesOption.className).toContain('bg-theme-primary-muted')
      expect(gasOption.className).not.toContain('bg-theme-primary-muted')
    })

    fireEvent.keyDown(search, { key: 'ArrowUp' })
    await waitFor(() => {
      expect(gasOption.className).toContain('bg-theme-primary-muted')
      expect(groceriesOption.className).not.toContain('bg-theme-primary-muted')
    })

    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(3)
    })
  })

  it('auto-highlights the create option when there are no matches', async () => {
    const onCreate = vi.fn(async () => 99)

    render(
      <DesktopDropdown
        value={undefined}
        options={[{ id: 1, label: 'Coffee' }]}
        placeholder="Select payee"
        emptyMessage="No matches found."
        allowCreate
        autoFocus
        onChange={vi.fn()}
        onCreate={onCreate}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    fireEvent.change(search, { target: { value: 'New payee' } })

    const createOption = screen.getByRole('button', { name: 'Create "New payee"' })
    expect(createOption.className).toContain('bg-theme-primary-muted')

    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('New payee')
    })
  })

  it('keeps natural order when opening above and selects closest item with ArrowUp', async () => {
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

    const search = await screen.findByPlaceholderText('Search...')

    const coffeeOption = screen.getByRole('button', { name: 'Coffee' })
    const gasOption = screen.getByRole('button', { name: 'Gas' })

    expect(coffeeOption.className).not.toContain('bg-theme-primary-muted')
    expect(gasOption.className).not.toContain('bg-theme-primary-muted')

    fireEvent.keyDown(search, { key: 'ArrowUp' })
    await waitFor(() => {
      expect(gasOption.className).toContain('bg-theme-primary-muted')
    })

    const panel = search.closest('div[style]')
    const content = panel?.querySelector('.overflow-y-auto') as HTMLDivElement | null
    expect(panel?.textContent).toMatch(/Recent.*Coffee.*Groceries.*All.*Gas/)
    expect(content?.scrollTop ?? -1).toBe(0)
    expect(panel?.className).not.toContain('flex-col-reverse')
  })

  it('sizes small result sets to their natural height', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 40,
      y: 120,
      top: 120,
      bottom: 160,
      left: 40,
      right: 320,
      width: 280,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect)
    vi.stubGlobal('innerHeight', 900)

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
        onChange={vi.fn()}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    const panel = search.closest('div[style]') as HTMLDivElement | null
    const content = panel?.querySelector('.overflow-y-auto') as HTMLDivElement | null

    expect(Number.parseFloat(panel?.style.height ?? '0')).toBe(147)
    expect(Number.parseFloat(content?.style.height ?? '0')).toBe(90)
  })

  it('opens below when the desired height fits below even if above has more space', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 40,
      y: 300,
      top: 300,
      bottom: 340,
      left: 40,
      right: 320,
      width: 280,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect)
    vi.stubGlobal('innerHeight', 500)

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
        onChange={vi.fn()}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    const panel = search.closest('div[style]') as HTMLDivElement | null

    expect(Number.parseFloat(panel?.style.top ?? '0')).toBe(344)
  })

  it('opens above when the desired height does not fit below but fits above', async () => {
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
        placeholder="Select payee"
        emptyMessage="No matches found."
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    const panel = search.closest('div[style]') as HTMLDivElement | null

    expect(Number.parseFloat(panel?.style.top ?? '0')).toBe(369)
  })

  it('opens above when below is usable but above can fit the full desired height', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 40,
      y: 330,
      top: 330,
      bottom: 370,
      left: 40,
      right: 320,
      width: 280,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect)
    vi.stubGlobal('innerHeight', 610)

    render(
      <DesktopDropdown
        value={undefined}
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
          { id: 4, label: 'Gym' },
          { id: 5, label: 'Insurance' },
          { id: 6, label: 'Rent' },
          { id: 7, label: 'Utilities' },
          { id: 8, label: 'Water' },
          { id: 9, label: 'Internet' },
          { id: 10, label: 'Phone' },
        ]}
        placeholder="Select payee"
        emptyMessage="No matches found."
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    const panel = search.closest('div[style]') as HTMLDivElement | null

    expect(Number.parseFloat(panel?.style.top ?? '0')).toBe(29)
  })

  it('opens above when below has about one row and above has more usable space', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 40,
      y: 500,
      top: 500,
      bottom: 540,
      left: 40,
      right: 320,
      width: 280,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect)
    vi.stubGlobal('innerHeight', 580)

    render(
      <DesktopDropdown
        value={undefined}
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
          { id: 4, label: 'Gym' },
          { id: 5, label: 'Insurance' },
          { id: 6, label: 'Rent' },
          { id: 7, label: 'Utilities' },
          { id: 8, label: 'Water' },
          { id: 9, label: 'Internet' },
          { id: 10, label: 'Phone' },
        ]}
        placeholder="Select payee"
        emptyMessage="No matches found."
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    const panel = search.closest('div[style]') as HTMLDivElement | null

    expect(Number.parseFloat(panel?.style.top ?? '0')).toBe(199)
    expect(Number.parseFloat(panel?.style.height ?? '0')).toBe(297)
  })

  it('falls back to opening below when neither side fits the desired height', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 40,
      y: 90,
      top: 90,
      bottom: 130,
      left: 40,
      right: 320,
      width: 280,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect)
    vi.stubGlobal('innerHeight', 220)

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
        onChange={vi.fn()}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    const panel = search.closest('div[style]') as HTMLDivElement | null

    await waitFor(() => {
      expect(Number.parseFloat(panel?.style.top ?? '0')).toBe(134)
      expect(Number.parseFloat(panel?.style.height ?? '0')).toBe(78)
    })
  })

  it('shrinks from the top while filtering above the trigger', async () => {
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
          { id: 4, label: 'Gym' },
        ]}
        recentOptions={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        placeholder="Select payee"
        emptyMessage="No matches found."
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    const panel = search.closest('div[style]') as HTMLDivElement | null
    const initialHeight = panel?.style.height
    const initialTop = panel?.style.top

    fireEvent.change(search, { target: { value: 'gas' } })

    expect(Number.parseFloat(panel?.style.height ?? '0')).toBeLessThan(Number.parseFloat(initialHeight ?? '0'))
    expect(Number.parseFloat(panel?.style.top ?? '0')).toBeGreaterThan(Number.parseFloat(initialTop ?? '0'))
  })

  it('shrinks from the bottom while filtering below the trigger', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 40,
      y: 120,
      top: 120,
      bottom: 160,
      left: 40,
      right: 320,
      width: 280,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect)
    vi.stubGlobal('innerHeight', 900)

    render(
      <DesktopDropdown
        value={undefined}
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
          { id: 4, label: 'Gym' },
          { id: 5, label: 'Insurance' },
          { id: 6, label: 'Rent' },
          { id: 7, label: 'Utilities' },
          { id: 8, label: 'Water' },
          { id: 9, label: 'Internet' },
          { id: 10, label: 'Phone' },
        ]}
        recentOptions={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        placeholder="Select payee"
        emptyMessage="No matches found."
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const search = await screen.findByPlaceholderText('Search...')
    const panel = search.closest('div[style]') as HTMLDivElement | null
    const initialHeight = panel?.style.height
    const initialTop = panel?.style.top

    fireEvent.change(search, { target: { value: 'gas' } })

    expect(Number.parseFloat(panel?.style.height ?? '0')).toBeLessThan(Number.parseFloat(initialHeight ?? '0'))
    expect(panel?.style.top).toBe(initialTop)
  })
})
