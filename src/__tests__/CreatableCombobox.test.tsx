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

    fireEvent.mouseDown(option)
    fireEvent.click(option)

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveFocus()
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })
})
