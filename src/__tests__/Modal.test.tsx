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
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="lg">
        Content
      </Modal>,
    )
    expect(document.body.querySelector('.sm\\:max-w-lg')).toBeInTheDocument()
  })

  it('calls onClose when pressing Escape', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        Content
      </Modal>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on native back button (popstate)', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        Content
      </Modal>,
    )
    fireEvent(window, new PopStateEvent('popstate'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders mobile full-screen header for xl size', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="xl">
        Content
      </Modal>,
    )
    // Two Cancel buttons (left and right) when no action is provided
    expect(screen.getAllByText('Cancel').length).toBe(2)
  })

  it('does not render mobile header for md size', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="md">
        Content
      </Modal>,
    )
    // Mobile header has sm:hidden, so it shouldn't be visible
    expect(screen.queryByLabelText('Cancel')).not.toBeInTheDocument()
  })

  it('calls onClose when clicking mobile Cancel button', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test" size="full">
        Content
      </Modal>,
    )
    fireEvent.click(screen.getAllByText('Cancel')[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders mobile action button when onMobileAction is provided', () => {
    const onAction = vi.fn()
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="full" mobileActionLabel="Save" onMobileAction={onAction}>
        Content
      </Modal>,
    )
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.queryByText('Cancel')).toBeInTheDocument()
  })

  it('calls onMobileAction when clicking mobile action button', () => {
    const onAction = vi.fn()
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="full" mobileActionLabel="Save" onMobileAction={onAction}>
        Content
      </Modal>,
    )
    fireEvent.click(screen.getByText('Save'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('toggles scroll class on content scroll', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="md">
        <div style={{ height: '2000px' }}>Tall content</div>
      </Modal>,
    )

    const contentDiv = document.body.querySelector('.overflow-y-auto')
    expect(contentDiv).not.toHaveClass('is-scrolling')

    if (contentDiv) {
      fireEvent.scroll(contentDiv)
      expect(contentDiv).toHaveClass('is-scrolling')
    }
  })
})
