import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Card from '../components/ui/Card'

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
