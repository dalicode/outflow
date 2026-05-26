import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Modal from '../components/ui/Modal'

describe('Modal', () => {
  const setVisualViewport = (
    width: number,
    height: number,
    offsetTop = 0,
    layoutHeight = height,
  ) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: width,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: layoutHeight,
    })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        width,
        height,
        offsetTop,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })
  }

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

  it('size md renders modal content visible', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="md">
        Content
      </Modal>,
    )
    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('size xl still renders modal content visible', () => {
    setVisualViewport(1280, 900)
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="XL Modal Test" size="xl">
        XL Content
      </Modal>,
    )
    expect(screen.getByText('XL Content')).toBeInTheDocument()
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
    setVisualViewport(390, 844)
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="xl">
        Content
      </Modal>,
    )
    expect(screen.getAllByText('Cancel').length).toBe(1)
  })

  it('does not render mobile header for md size', () => {
    setVisualViewport(390, 844)
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="md">
        Content
      </Modal>,
    )
    // Mobile header has sm:hidden, so it shouldn't be visible
    expect(screen.queryByLabelText('Cancel')).not.toBeInTheDocument()
  })

  it('mobile full-screen shows Cancel button', () => {
    setVisualViewport(390, 844)
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="full">
        Content
      </Modal>,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('calls onClose when clicking mobile Cancel button', () => {
    const onClose = vi.fn()
    setVisualViewport(390, 844)
    render(
      <Modal isOpen={true} onClose={onClose} title="Test" size="full">
        Content
      </Modal>,
    )
    fireEvent.click(screen.getAllByText('Cancel')[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders mobile action button in the footer when onMobileAction is provided', () => {
    const onAction = vi.fn()
    setVisualViewport(390, 844)
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Test"
        size="full"
        mobileActionLabel="Save"
        onMobileAction={onAction}
      >
        Content
      </Modal>,
    )
    const action = screen.getByRole('button', { name: 'Save' })
    expect(action).toBeEnabled()
    expect(screen.getAllByText('Cancel').length).toBe(1)
  })

  it('calls onMobileAction when clicking mobile action button', () => {
    const onAction = vi.fn()
    setVisualViewport(390, 844)
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Test"
        size="full"
        mobileActionLabel="Save"
        onMobileAction={onAction}
      >
        Content
      </Modal>,
    )
    fireEvent.click(screen.getByText('Save'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('keeps the mobile full-screen footer anchored when the keyboard shrinks the visual viewport', () => {
    setVisualViewport(390, 520, 0, 844)
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="full" mobileActionLabel="Save" onMobileAction={vi.fn()}>
        <input type="text" aria-label="Amount" />
      </Modal>,
    )

    const action = screen.getByRole('button', { name: 'Save' })
    expect(action.parentElement).not.toHaveStyle({ transform: 'translateY(-390px)' })
    expect(action.parentElement?.style.transform).toBe('')
  })

  describe('focus trap', () => {
    it('moves focus to first focusable element when opening', async () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <input type="text" placeholder="Name" />
          <button>Save</button>
        </Modal>,
      )

      // Wait for requestAnimationFrame to fire
      await new Promise((resolve) => requestAnimationFrame(resolve))

      // The close button in the header is the first focusable element
      const closeBtn = screen.getByLabelText('Close')
      expect(closeBtn).toBe(document.activeElement)
    })

    it('cycles Tab from last element back to first', async () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <input type="text" placeholder="Name" />
          <button>Save</button>
        </Modal>,
      )

      // Wait for focus trap to initialize
      await new Promise((resolve) => requestAnimationFrame(resolve))

      const focusable = document.body.querySelectorAll('input, button')
      expect(focusable.length).toBeGreaterThanOrEqual(2)
      const last = focusable[focusable.length - 1] as HTMLElement
      const first = focusable[0] as HTMLElement

      last.focus()
      fireEvent.keyDown(document, { key: 'Tab' })
      expect(document.activeElement).toBe(first)
    })

    it('cycles Shift+Tab from first element to last', async () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <input type="text" placeholder="Name" />
          <button>Save</button>
        </Modal>,
      )

      // Wait for focus trap to initialize
      await new Promise((resolve) => requestAnimationFrame(resolve))

      const focusable = document.body.querySelectorAll('input, button')
      expect(focusable.length).toBeGreaterThanOrEqual(2)
      const first = focusable[0] as HTMLElement
      const last = focusable[focusable.length - 1] as HTMLElement

      first.focus()
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(last)
    })

    it('restores focus to previously focused element when closing', async () => {
      const Trigger = () => {
        const [open, setOpen] = useState(false)
        return (
          <>
            <button data-testid="trigger" onClick={() => setOpen(true)}>
              Open
            </button>
            <Modal isOpen={open} onClose={() => setOpen(false)} title="Test Modal">
              <input type="text" placeholder="Name" />
            </Modal>
          </>
        )
      }

      render(<Trigger />)
      const trigger = screen.getByTestId('trigger')

      // Focus the trigger, then open the modal
      trigger.focus()
      fireEvent.click(trigger)

      // Wait for focus to move into modal
      await new Promise((resolve) => requestAnimationFrame(resolve))

      // The close button in the header gets focused
      const closeBtn = screen.getByLabelText('Close')
      expect(document.activeElement).toBe(closeBtn)

      // Close the modal
      fireEvent.click(closeBtn)

      // Wait for focus restoration
      await waitFor(() => expect(document.activeElement).toBe(trigger))
    })
  })
})
