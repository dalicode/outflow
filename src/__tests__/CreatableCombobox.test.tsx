import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import CreatableCombobox from '../components/inputs/CreatableCombobox'

describe('CreatableCombobox', () => {
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

  it('highlights the first row when opened and selects it with Enter', async () => {
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
    expect(firstOption).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(1)
    })
  })

  it('highlights the first filtered row while typing and allows arrow navigation', async () => {
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
})
