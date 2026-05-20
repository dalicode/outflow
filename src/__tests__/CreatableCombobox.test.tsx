import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CreatableCombobox from '../components/inputs/CreatableCombobox'

describe('CreatableCombobox', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('preserves typed text if a click open lands after typing starts', async () => {
    render(
      <CreatableCombobox
        value=""
        options={[
          { id: 1, label: 'Yonder Ledger' },
          { id: 2, label: 'Zephyr Ledger' },
        ]}
        variant="inline"
        openOnClick
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'yon' } })
    fireEvent.click(input)

    expect(input).toHaveValue('yon')
    expect(screen.getByRole('option', { name: 'Yonder Ledger' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Zephyr Ledger' })).not.toBeInTheDocument()
  })

  it('preserves replacement text when inline auto-open starts with a selected value', async () => {
    render(
      <CreatableCombobox
        value={1}
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        variant="inline"
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('combobox')
    expect(input).toHaveValue('Coffee')

    fireEvent.change(input, { target: { value: 'Gro' } })

    expect(input).toHaveValue('Gro')
    expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Coffee' })).not.toBeInTheDocument()
  })

  it('preserves typed inline text across rerenders when value and options are unchanged', async () => {
    const onChange = vi.fn()
    const options = [
      { id: 1, label: 'Coffee' },
      { id: 2, label: 'Groceries' },
    ]

    const { rerender } = render(
      <CreatableCombobox
        value={1}
        options={options}
        variant="inline"
        autoOpen
        autoFocus
        onChange={onChange}
      />,
    )

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Gro' } })

    rerender(
      <CreatableCombobox
        value={1}
        options={options}
        variant="inline"
        autoOpen
        autoFocus
        onChange={onChange}
      />,
    )

    expect(screen.getByRole('combobox')).toHaveValue('Gro')
    expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Coffee' })).not.toBeInTheDocument()
  })

  it('does not reopen after selection when the inline editor remounts', async () => {
    function RemountingCombobox() {
      const [value, setValue] = useState<string | number>(1)
      const [autoOpen, setAutoOpen] = useState(true)

      return (
        <CreatableCombobox
          key={value}
          value={value}
          options={[
            { id: 1, label: 'Coffee' },
            { id: 2, label: 'Groceries' },
          ]}
          variant="inline"
          autoOpen={autoOpen}
          autoFocus
          onChange={(id) => {
            setAutoOpen(false)
            setValue(id ?? '')
          }}
        />
      )
    }

    render(<RemountingCombobox />)

    const option = screen.getByRole('option', { name: 'Groceries' })

    fireEvent.pointerDown(option)

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveFocus()
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  it('commits on Enter without advancing to the next field', async () => {
    const onChange = vi.fn()
    const onTab = vi.fn()

    render(
      <CreatableCombobox
        value={1}
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        variant="inline"
        autoOpen
        autoFocus
        onChange={onChange}
        onTab={onTab}
      />,
    )

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Gro' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(2)
      expect(onTab).not.toHaveBeenCalled()
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  it('does not auto-highlight on open and selects with ArrowDown + Enter', async () => {
    const onChange = vi.fn()

    render(
      <CreatableCombobox
        value=""
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        variant="inline"
        autoOpen
        autoFocus
        onChange={onChange}
      />,
    )

    const firstOption = screen.getByRole('option', { name: 'Coffee' })
    const secondOption = screen.getByRole('option', { name: 'Groceries' })
    expect(firstOption).not.toHaveAttribute('aria-selected', 'true')
    expect(secondOption).not.toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    expect(firstOption).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(1)
    })
  })

  it('does not auto-highlight on type and allows arrow navigation', async () => {
    const onChange = vi.fn()

    render(
      <CreatableCombobox
        value=""
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
        ]}
        variant="inline"
        autoOpen
        autoFocus
        onChange={onChange}
      />,
    )

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'g' } })

    const gasOption = screen.getByRole('option', { name: 'Gas' })
    const groceriesOption = screen.getByRole('option', { name: 'Groceries' })

    expect(gasOption).toHaveAttribute('aria-selected', 'false')
    expect(groceriesOption).toHaveAttribute('aria-selected', 'false')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(gasOption).toHaveAttribute('aria-selected', 'true')
    expect(groceriesOption).toHaveAttribute('aria-selected', 'false')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(gasOption).toHaveAttribute('aria-selected', 'false')
    expect(groceriesOption).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(gasOption).toHaveAttribute('aria-selected', 'true')
    expect(groceriesOption).toHaveAttribute('aria-selected', 'false')

    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(3)
    })
  })

  it('uses onEnterSelect for keyboard commit flow and passes shift state', async () => {
    const onChange = vi.fn()
    const onEnterSelect = vi.fn()

    render(
      <CreatableCombobox
        value=""
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        variant="inline"
        autoOpen
        autoFocus
        onChange={onChange}
        onEnterSelect={onEnterSelect}
      />,
    )

    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    await waitFor(() => {
      expect(onEnterSelect).toHaveBeenCalledWith(2, true)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  it('uses onTabSelect for highlighted keyboard commit before moving on', async () => {
    const onChange = vi.fn()
    const onTab = vi.fn()
    const onTabSelect = vi.fn()

    render(
      <CreatableCombobox
        value=""
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        variant="inline"
        autoOpen
        autoFocus
        onChange={onChange}
        onTab={onTab}
        onTabSelect={onTabSelect}
      />,
    )

    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })

    await waitFor(() => {
      expect(onTabSelect).toHaveBeenCalledWith(2, true)
      expect(onTab).toHaveBeenCalledWith(true)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  it('keeps blur commits on the current value instead of the highlighted row', async () => {
    const onChange = vi.fn()

    render(
      <CreatableCombobox
        value={2}
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        variant="inline"
        autoOpen
        autoFocus
        onChange={onChange}
      />,
    )

    fireEvent.blur(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(2)
    })
  })

  it('uses onEnterSelect when creating a new option via Enter', async () => {
    const onChange = vi.fn()
    const onEnterSelect = vi.fn()
    const onCreate = vi.fn(async () => 99)

    render(
      <CreatableCombobox
        value=""
        options={[{ id: 1, label: 'Coffee' }]}
        variant="inline"
        autoOpen
        autoFocus
        allowCreate
        onCreate={onCreate}
        onChange={onChange}
        onEnterSelect={onEnterSelect}
      />,
    )

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'New payee' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('New payee')
      expect(onEnterSelect).toHaveBeenCalledWith(99, true)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  it('uses onTabSelect when creating a new option via Tab', async () => {
    const onChange = vi.fn()
    const onTab = vi.fn()
    const onTabSelect = vi.fn()
    const onCreate = vi.fn(async () => 77)

    render(
      <CreatableCombobox
        value=""
        options={[{ id: 1, label: 'Coffee' }]}
        variant="inline"
        autoOpen
        autoFocus
        allowCreate
        onCreate={onCreate}
        onChange={onChange}
        onTab={onTab}
        onTabSelect={onTabSelect}
      />,
    )

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'New category' } })
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('New category')
      expect(onTabSelect).toHaveBeenCalledWith(77, true)
      expect(onTab).toHaveBeenCalledWith(true)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  it('renders recent and all sections in natural order when opening below', async () => {
    render(
      <CreatableCombobox
        value=""
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
        openOnClick
        onChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('combobox'))

    const listbox = await screen.findByRole('listbox')
    expect(listbox.textContent).toMatch(/Recent.*Coffee.*Groceries.*All.*Gas/)
  })

  it('keeps natural section order when opening above and highlights the closest visible item with ArrowUp', async () => {
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
      <CreatableCombobox
        value=""
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
        ]}
        recentOptions={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
        ]}
        autoOpen
        autoFocus
        onChange={onChange}
      />,
    )

    const input = screen.getByRole('combobox')
    const listbox = await screen.findByRole('listbox')
    const coffeeOption = screen.getByRole('option', { name: 'Coffee' })
    const gasOption = screen.getByRole('option', { name: 'Gas' })

    expect(listbox.textContent).toMatch(/Recent.*Coffee.*Groceries.*All.*Gas/)
    expect(coffeeOption).toHaveAttribute('aria-selected', 'false')
    expect(gasOption).toHaveAttribute('aria-selected', 'false')

    fireEvent.keyDown(input, { key: 'ArrowUp' })

    expect(gasOption).toHaveAttribute('aria-selected', 'true')
    expect(coffeeOption).toHaveAttribute('aria-selected', 'false')
    expect((listbox.firstElementChild as HTMLDivElement | null)?.scrollTop ?? -1).toBe(0)
  })

  it('caps the open dropdown to 8 visible entries when space allows', async () => {
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
      <CreatableCombobox
        value=""
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
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const listbox = await screen.findByRole('listbox')
    expect(Number.parseFloat(listbox.style.height)).toBe(300)
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
      <CreatableCombobox
        value=""
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
        ]}
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const listbox = await screen.findByRole('listbox')
    expect(Number.parseFloat(listbox.style.height)).toBe(90)
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
      <CreatableCombobox
        value=""
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
        ]}
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const listbox = await screen.findByRole('listbox')
    expect(Number.parseFloat(listbox.style.top)).toBe(344)
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
      <CreatableCombobox
        value=""
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
        ]}
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const listbox = await screen.findByRole('listbox')
    expect(Number.parseFloat(listbox.style.top)).toBe(426)
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
    vi.stubGlobal('innerHeight', 550)

    render(
      <CreatableCombobox
        value=""
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
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const listbox = await screen.findByRole('listbox')
    expect(Number.parseFloat(listbox.style.top)).toBe(86)
  })

  it('recomputes placement after opening when a selected value initially filters the closed state', async () => {
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
    vi.stubGlobal('innerHeight', 550)

    render(
      <CreatableCombobox
        value={3}
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
        variant="inline"
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const listbox = await screen.findByRole('listbox')
    expect(Number.parseFloat(listbox.style.top)).toBe(86)
    expect(screen.getByRole('option', { name: 'Coffee' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Phone' })).toBeInTheDocument()
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
      <CreatableCombobox
        value=""
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
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const listbox = await screen.findByRole('listbox')
    expect(Number.parseFloat(listbox.style.top)).toBe(256)
    expect(Number.parseFloat(listbox.style.height)).toBe(240)
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
      <CreatableCombobox
        value=""
        options={[
          { id: 1, label: 'Coffee' },
          { id: 2, label: 'Groceries' },
          { id: 3, label: 'Gas' },
        ]}
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const listbox = await screen.findByRole('listbox')
    expect(Number.parseFloat(listbox.style.top)).toBe(134)
    expect(Number.parseFloat(listbox.style.height)).toBe(60)
  })

  it('shrinks from the top when filtering above the trigger', async () => {
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
      <CreatableCombobox
        value=""
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
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('combobox')
    const listbox = await screen.findByRole('listbox')
    const initialHeight = listbox.style.height
    const initialTop = listbox.style.top

    fireEvent.change(input, { target: { value: 'gas' } })

    expect(Number.parseFloat(listbox.style.height)).toBeLessThan(Number.parseFloat(initialHeight))
    expect(Number.parseFloat(listbox.style.top)).toBeGreaterThan(Number.parseFloat(initialTop))
  })

  it('shrinks from the bottom when filtering below the trigger', async () => {
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
      <CreatableCombobox
        value=""
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
        autoOpen
        autoFocus
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('combobox')
    const listbox = await screen.findByRole('listbox')
    const initialHeight = listbox.style.height
    const initialTop = listbox.style.top

    fireEvent.change(input, { target: { value: 'gas' } })

    expect(Number.parseFloat(listbox.style.height)).toBeLessThan(Number.parseFloat(initialHeight))
    expect(listbox.style.top).toBe(initialTop)
  })

  it('anchors inline dropdowns to the table cell bottom edge when opened below', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.tagName === 'TD') {
        return {
          x: 40,
          y: 520,
          top: 520,
          bottom: 560,
          left: 40,
          right: 320,
          width: 280,
          height: 40,
          toJSON: () => ({}),
        } as DOMRect
      }

      return {
        x: 40,
        y: 120,
        top: 120,
        bottom: 160,
        left: 40,
        right: 320,
        width: 280,
        height: 40,
        toJSON: () => ({}),
      } as DOMRect
    })
    vi.stubGlobal('innerHeight', 900)

    render(
      <table>
        <tbody>
          <tr>
            <td>
              <CreatableCombobox
                value=""
                options={[
                  { id: 1, label: 'Coffee' },
                  { id: 2, label: 'Groceries' },
                ]}
                variant="inline"
                autoOpen
                autoFocus
                onChange={vi.fn()}
              />
            </td>
          </tr>
        </tbody>
      </table>,
    )

    const listbox = await screen.findByRole('listbox')
    expect(Number.parseFloat(listbox.style.top)).toBe(564)
    expect(Number.parseFloat(listbox.style.left)).toBe(40)
  })

  it('anchors inline dropdowns to the table cell top edge when opened above', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.tagName === 'TD') {
        return {
          x: 40,
          y: 520,
          top: 520,
          bottom: 560,
          left: 40,
          right: 320,
          width: 280,
          height: 40,
          toJSON: () => ({}),
        } as DOMRect
      }

      return {
        x: 60,
        y: 530,
        top: 530,
        bottom: 550,
        left: 60,
        right: 240,
        width: 180,
        height: 20,
        toJSON: () => ({}),
      } as DOMRect
    })
    vi.stubGlobal('innerHeight', 620)

    render(
      <table>
        <tbody>
          <tr>
            <td>
              <CreatableCombobox
                value=""
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
                variant="inline"
                autoOpen
                autoFocus
                onChange={vi.fn()}
              />
            </td>
          </tr>
        </tbody>
      </table>,
    )

    const listbox = await screen.findByRole('listbox')
    expect(Number.parseFloat(listbox.style.top)).toBe(216)
    expect(Number.parseFloat(listbox.style.bottom)).toBe(104)
    expect(Number.parseFloat(listbox.style.left)).toBe(40)
  })
})
