import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    render(
      <DatePicker
        value="2024-06-15"
        autoOpen
        onChange={vi.fn()}
      />,
    )

    // Header should show June 2024
    expect(screen.getByText('Jun 2024')).toBeInTheDocument()

    // Active day (15) should be highlighted
    const day15 = screen.getAllByText('15').find((el) =>
      el.className.includes('bg-theme-primary'),
    )
    expect(day15).toBeDefined()
  })

  it('opens popup on focus for inline variant', () => {
    render(
      <DatePicker
        value="2024-06-15"
        variant="inline"
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    expect(screen.getByText('Jun 2024')).toBeInTheDocument()
  })

  it('opens closed popup with ArrowDown, Enter, or Space', () => {
    render(
      <DatePicker
        value="2024-06-15"
        onChange={vi.fn()}
      />,
    )

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
    render(
      <DatePicker
        value="2024-06-15"
        autoOpen
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox')

    // Move right to 16
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    const day16 = screen.getAllByText('16').find((el) =>
      el.className.includes('bg-theme-primary'),
    )
    expect(day16).toBeDefined()

    // Move left back to 15
    fireEvent.keyDown(input, { key: 'ArrowLeft' })
    const day15 = screen.getAllByText('15').find((el) =>
      el.className.includes('bg-theme-primary'),
    )
    expect(day15).toBeDefined()

    // Move down to 22
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const day22 = screen.getAllByText('22').find((el) =>
      el.className.includes('bg-theme-primary'),
    )
    expect(day22).toBeDefined()

    // Move up back to 15
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    const day15Again = screen.getAllByText('15').find((el) =>
      el.className.includes('bg-theme-primary'),
    )
    expect(day15Again).toBeDefined()
  })

  it('crosses month boundaries with arrow keys and auto-scrolls view', () => {
    render(
      <DatePicker
        value="2024-06-30"
        autoOpen
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox')

    // June 30 → July 1
    fireEvent.keyDown(input, { key: 'ArrowRight' })

    // View should have scrolled to July
    expect(screen.getByText('Jul 2024')).toBeInTheDocument()

    // July 1 should be highlighted
    const day1 = screen.getAllByText('1').find((el) =>
      el.className.includes('bg-theme-primary'),
    )
    expect(day1).toBeDefined()
  })

  it('syncs text input as active date changes', () => {
    render(
      <DatePicker
        value="2024-06-15"
        autoOpen
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('06/15/2024')

    // Move to next day
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(input.value).toBe('06/16/2024')

    // Move down a week
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('06/23/2024')
  })

  it('selects active day with Enter', () => {
    const onChange = vi.fn()
    render(
      <DatePicker
        value="2024-06-15"
        autoOpen
        onChange={onChange}
      />,
    )

    const input = screen.getByRole('textbox')

    // Move to 16
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    // Press Enter
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('2024-06-16')
  })

  it('changes month with PageUp and PageDown', () => {
    render(
      <DatePicker
        value="2024-06-15"
        autoOpen
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox')

    fireEvent.keyDown(input, { key: 'PageUp' })
    expect(screen.getByText('May 2024')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'PageDown' })
    expect(screen.getByText('Jun 2024')).toBeInTheDocument()
  })

  it('jumps to first and last day with Home and End', () => {
    render(
      <DatePicker
        value="2024-06-15"
        autoOpen
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox')

    fireEvent.keyDown(input, { key: 'Home' })
    const day1 = screen.getAllByText('1').find((el) =>
      el.className.includes('bg-theme-primary'),
    )
    expect(day1).toBeDefined()

    fireEvent.keyDown(input, { key: 'End' })
    const day30 = screen.getAllByText('30').find((el) =>
      el.className.includes('bg-theme-primary'),
    )
    expect(day30).toBeDefined()
  })

  it('closes popup on Escape and calls onCancel', () => {
    const onCancel = vi.fn()
    render(
      <DatePicker
        value="2024-06-15"
        autoOpen
        onChange={vi.fn()}
        onCancel={onCancel}
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByText('Jun 2024')).not.toBeInTheDocument()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not close popup when clicking inside the calendar', () => {
    const onChange = vi.fn()
    render(
      <DatePicker
        value="2024-06-15"
        autoOpen
        onChange={onChange}
      />,
    )

    // Click on a day inside the popup
    const day16 = screen.getAllByText('16').find((el) =>
      el.className.includes('text-theme-text'),
    )
    expect(day16).toBeDefined()
    fireEvent.click(day16!)

    // The day should have been selected
    expect(onChange).toHaveBeenCalledWith('2024-06-16')
  })
})
