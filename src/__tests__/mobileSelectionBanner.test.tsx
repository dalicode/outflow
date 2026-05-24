import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MobileSelectionBanner from '../features/dashboard/components/MobileSelectionBanner'

describe('MobileSelectionBanner', () => {
  it('renders and executes extra menu actions', () => {
    const onEdit = vi.fn()
    const onCopy = vi.fn()
    const onDelete = vi.fn()
    const onSelectAll = vi.fn()
    const onDeselectAll = vi.fn()
    const onUnsplit = vi.fn()

    render(
      <MobileSelectionBanner
        count={2}
        onEdit={onEdit}
        onCopy={onCopy}
        onDelete={onDelete}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        extraMenuActions={[
          {
            label: 'Unsplit transaction',
            onClick: onUnsplit,
            danger: true,
          },
        ]}
      />,
    )

    fireEvent.click(screen.getByTestId('btn-selection-menu'))
    fireEvent.click(screen.getByRole('button', { name: 'Unsplit transaction' }))
    expect(onUnsplit).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('btn-selection-menu'))
    fireEvent.click(screen.getByTestId('btn-copy-selection'))
    expect(onCopy).toHaveBeenCalledTimes(1)
  })
})
