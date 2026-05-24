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

  it('renders actions when provided', () => {
    render(
      <Card title="With Actions" actions={<button>Action</button>}>
        Content
      </Card>,
    )
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('does not render title section when no title provided', () => {
    render(<Card>Content</Card>)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
