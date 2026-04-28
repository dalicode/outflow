import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal from '../components/ui/Modal'

describe('Modal', () => {
  it('renders when open', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        Modal Content
      </Modal>,
    )
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        Modal Content
      </Modal>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('calls onClose when clicking the X button', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        Content
      </Modal>,
    )

    const closeButton = screen.getByLabelText('Close')
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the overlay', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        Content
      </Modal>,
    )

    const overlay = container.querySelector('[role="dialog"]')
    if (overlay) {
      fireEvent.click(overlay)
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })

  it('does not call onClose when clicking modal content', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        Content
      </Modal>,
    )

    fireEvent.click(screen.getByText('Content'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('applies size classes', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="lg">
        Content
      </Modal>,
    )
    expect(container.querySelector('.sm\\:max-w-lg')).toBeInTheDocument()
  })
})
