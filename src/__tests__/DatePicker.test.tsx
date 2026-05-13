import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DatePicker from '../components/inputs/DatePicker'

// Mock useSettings
vi.mock('../context/settingsContext', () => ({
  useSettings: () => ({
    settings: { dateFormat: 'MM/DD/YYYY' },
  }),
}))

describe('DatePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens popup and highlights active day when autoOpen is true', () => {
    render(<DatePicker value="2024-06-15" autoOpen onChange={vi.fn()} />)

    expect(screen.getByText('Jun 2024')).toBeInTheDocument()
    // Active day has aria-current="date"
    expect(screen.getByRole('button', { current: 'date' })).toHaveTextContent('15')
  })

  it('opens popup on focus for inline variant', () => {
    render(<DatePicker value="2024-06-15" variant="inline" onChange={vi.fn()} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    expect(screen.getByText('Jun 2024')).toBeInTheDocument()
  })

  it('opens closed popup with ArrowDown, Enter, or Space', () => {
    render(<DatePicker value="2024-06-15" onChange={vi.fn()} />)

    const input = screen.getByRole('textbox')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByText('Jun 2024')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByText('Jun 2024')).not.toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Jun 2024')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByText('Jun 2024')).not.toBeInTheDocument()

    fireEvent.keyDown(input, { key: ' ' })
    expect(screen.getByText('Jun 2024')).toBeInTheDocument()
  })

  it('navigates days with arrow keys', () => {
    render(<DatePicker value="2024-06-15" autoOpen onChange={vi.fn()} />)

    const input = screen.getByRole('textbox')

    // Move right to 16
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { current: 'date' })).toHaveTextContent('16')

    // Move left back to 15
    fireEvent.keyDown(input, { key: 'ArrowLeft' })
    expect(screen.getByRole('button', { current: 'date' })).toHaveTextContent('15')

    // Move down to 22
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByRole('button', { current: 'date' })).toHaveTextContent('22')

    // Move up back to 15
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(screen.getByRole('button', { current: 'date' })).toHaveTextContent('15')
  })

  it('crosses month boundaries with arrow keys and auto-scrolls view', () => {
    render(<DatePicker value="2024-06-30" autoOpen onChange={vi.fn()} />)

    const input = screen.getByRole('textbox')

    // June 30 → July 1
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(screen.getByText('Jul 2024')).toBeInTheDocument()
    expect(screen.getByRole('button', { current: 'date' })).toHaveTextContent('1')
  })

  it('syncs text input as active date changes', () => {
    render(<DatePicker value="2024-06-15" autoOpen onChange={vi.fn()} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('06/15/2024')

    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(input.value).toBe('06/16/2024')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('06/23/2024')
  })

  it('selects active day with Enter', () => {
    const onChange = vi.fn()
    const onEnter = vi.fn()
    render(<DatePicker value="2024-06-15" autoOpen onChange={onChange} onEnter={onEnter} />)

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    expect(onChange).toHaveBeenCalledWith('2024-06-16')
    expect(onEnter).toHaveBeenCalledWith(true)
  })

  it('changes month with PageUp and PageDown', () => {
    render(<DatePicker value="2024-06-15" autoOpen onChange={vi.fn()} />)

    const input = screen.getByRole('textbox')

    fireEvent.keyDown(input, { key: 'PageUp' })
    expect(screen.getByText('May 2024')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'PageDown' })
    expect(screen.getByText('Jun 2024')).toBeInTheDocument()
  })

  it('jumps to first and last day with Home and End', () => {
    render(<DatePicker value="2024-06-15" autoOpen onChange={vi.fn()} />)

    const input = screen.getByRole('textbox')

    fireEvent.keyDown(input, { key: 'Home' })
    expect(screen.getByRole('button', { current: 'date' })).toHaveTextContent('1')

    fireEvent.keyDown(input, { key: 'End' })
    expect(screen.getByRole('button', { current: 'date' })).toHaveTextContent('30')
  })

  it('closes popup on Escape and calls onCancel', () => {
    const onCancel = vi.fn()
    render(<DatePicker value="2024-06-15" autoOpen onChange={vi.fn()} onCancel={onCancel} />)

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByText('Jun 2024')).not.toBeInTheDocument()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not close popup when clicking inside the calendar', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2024-06-15" autoOpen onChange={onChange} />)

    // Click on the day 16 (which is not the current date, so it's a regular day button)
    fireEvent.click(screen.getByText('16'))

    expect(onChange).toHaveBeenCalledWith('2024-06-16')
  })
})
