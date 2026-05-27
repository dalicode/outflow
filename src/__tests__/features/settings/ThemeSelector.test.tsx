import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ThemeSelector from '@/features/settings/ThemeSelector'

describe('ThemeSelector', () => {
  it('renders Sharp Professional Dark and other sharp dark variants first', () => {
    render(<ThemeSelector value="sharpProfessionalDark" onChange={vi.fn()} />)

    const themeButtons = screen.getAllByRole('button')
    expect(themeButtons[0]).toHaveTextContent('Sharp Professional Dark')
    expect(themeButtons[1]).toHaveTextContent('Sharp Professional Steel')
    expect(themeButtons[2]).toHaveTextContent('Sharp Professional')
  })

  it('calls onChange with the clicked theme id', () => {
    const onChange = vi.fn()
    render(<ThemeSelector value="default" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /sharp professional dark/i }))

    expect(onChange).toHaveBeenCalledWith('sharpProfessionalDark')
  })
})
