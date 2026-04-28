import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Card from './Card'

describe('Card', () => {
  it('renders children content', () => {
    render(<Card>Test Content</Card>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('renders with title', () => {
    render(<Card title="Card Title">Content</Card>)
    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('applies default variant styling', () => {
    const { container } = render(<Card>Default</Card>)
    expect(container.firstChild).toHaveClass('bg-theme-surface')
    expect(container.firstChild).toHaveClass('rounded-xl')
    expect(container.firstChild).toHaveClass('shadow-sm')
  })

  it('applies elevated variant styling', () => {
    const { container } = render(<Card variant="elevated">Elevated</Card>)
    expect(container.firstChild).toHaveClass('shadow-md')
    expect(container.firstChild).toHaveClass('hover:shadow-lg')
  })

  it('applies minimal variant styling', () => {
    const { container } = render(<Card variant="minimal">Minimal</Card>)
    expect(container.firstChild).toHaveClass('bg-theme-surface')
    expect(container.firstChild).not.toHaveClass('shadow-sm')
    expect(container.firstChild).not.toHaveClass('shadow-md')
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('renders actions when provided', () => {
    render(
      <Card title="With Actions" actions={<button>Action</button>}>
        Content
      </Card>,
    )
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('does not render title section when no title provided', () => {
    const { container } = render(<Card>Content</Card>)
    const headers = container.querySelectorAll('h3')
    expect(headers.length).toBe(0)
  })
})
