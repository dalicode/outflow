import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OutflowMark from '../components/ui/OutflowMark'
import OutflowWordmark from '../components/ui/OutflowWordmark'

describe('OutflowMark', () => {
  it('renders an SVG', () => {
    const { container } = render(<OutflowMark />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<OutflowMark className="custom-mark" />)
    expect(container.querySelector('svg')).toHaveClass('custom-mark')
  })

  it('has correct viewBox', () => {
    const { container } = render(<OutflowMark />)
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 64 64')
  })
})

describe('OutflowWordmark', () => {
  it('renders an SVG', () => {
    const { container } = render(<OutflowWordmark />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<OutflowWordmark className="custom-wordmark" />)
    expect(container.querySelector('svg')).toHaveClass('custom-wordmark')
  })

  it('has correct viewBox', () => {
    const { container } = render(<OutflowWordmark />)
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 520 80')
  })

  it('renders Outflow text', () => {
    const { container } = render(<OutflowWordmark />)
    expect(container.querySelector('text')?.textContent).toBe('Outflow')
  })
})
