import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PrivateValue from '../components/privacy/PrivateValue'

let privacyModeEnabled = false
let loaded = true

vi.mock('../context/settingsContext', () => ({
  useSettings: () => ({
    privacyModeEnabled,
    loaded,
  }),
}))

describe('PrivateValue', () => {
  it('renders real content when privacy mode is off', () => {
    privacyModeEnabled = false
    loaded = true

    render(<PrivateValue>$123.45</PrivateValue>)

    expect(screen.getByText('$123.45')).toBeInTheDocument()
    expect(screen.queryByText('$888,888.88')).not.toBeInTheDocument()
  })

  it('renders a fixed long money mask when privacy mode is on', () => {
    privacyModeEnabled = true
    loaded = true

    render(<PrivateValue>$12.34</PrivateValue>)

    expect(screen.getByText('$888,888.88')).toBeInTheDocument()
    expect(screen.queryByText('$12.34')).not.toBeInTheDocument()
  })

  it('uses the same money mask for values with different digit counts', () => {
    privacyModeEnabled = true
    loaded = true

    const { rerender } = render(<PrivateValue>$9.00</PrivateValue>)
    expect(screen.getByText('$888,888.88')).toBeInTheDocument()

    rerender(<PrivateValue>$123,456.78</PrivateValue>)
    expect(screen.getByText('$888,888.88')).toBeInTheDocument()
    expect(screen.queryByText('$123,456.78')).not.toBeInTheDocument()
  })

  it('renders a percentage mask for percentage values', () => {
    privacyModeEnabled = true
    loaded = true

    render(<PrivateValue>12.5%</PrivateValue>)

    expect(screen.getByText('888.88%')).toBeInTheDocument()
    expect(screen.queryByText('12.5%')).not.toBeInTheDocument()
  })

  it('hides real value before settings load completes', () => {
    privacyModeEnabled = false
    loaded = false

    render(<PrivateValue>$123.45</PrivateValue>)

    expect(screen.getByText('$888,888.88')).toBeInTheDocument()
    expect(screen.queryByText('$123.45')).not.toBeInTheDocument()
  })
})
