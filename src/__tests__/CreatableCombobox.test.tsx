import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
})
