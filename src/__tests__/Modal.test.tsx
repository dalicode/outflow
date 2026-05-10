import { fireEvent, render, screen } from '@testing-library/react'
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

  it('applies size classes', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="lg">
        Content
      </Modal>,
    )
    expect(document.body.querySelector('.sm\\:max-w-lg')).toBeInTheDocument()
  })

  it('positions small desktop modals 15 percent from the top', () => {
    setVisualViewport(1280, 900)

    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="md">
        Content
      </Modal>,
    )

    const overlay = document.body.querySelector('[role="dialog"]') as HTMLElement

    expect(overlay).toHaveClass('sm:items-start')
    expect(overlay).toHaveClass('sm:pt-[15vh]')
  })

  it('centers large desktop modals', () => {
    setVisualViewport(1280, 900)

    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="xl">
        Content
      </Modal>,
    )

    const overlay = document.body.querySelector('[role="dialog"]') as HTMLElement

    expect(overlay).toHaveClass('sm:items-center')
    expect(overlay).toHaveClass('sm:pt-4')
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

  it('supports mobile full-screen behavior without changing desktop size', () => {
    setVisualViewport(390, 844)
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="md" mobileFullScreen>
        Content
      </Modal>,
    )

    const overlay = document.body.querySelector('[role="dialog"]') as HTMLElement
    const modalCard = overlay.firstElementChild as HTMLElement

    expect(screen.getAllByText('Cancel').length).toBe(1)
    expect(modalCard).toHaveClass('w-screen')
    expect(modalCard).toHaveClass('sm:max-w-md')
    expect(modalCard.style.height).toBe('844px')
  })

  it('locks body scroll while open and restores it on close', async () => {
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 240,
    })
    window.scrollTo = vi.fn()

    const { rerender } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        Content
      </Modal>,
    )

    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.top).toBe('-240px')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.touchAction).toBe('none')

    rerender(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        Content
      </Modal>,
    )

    // Deferred via queueMicrotask — wait for it to execute
    await new Promise((r) => setTimeout(r, 0))

    expect(document.body.style.position).toBe('')
    expect(document.body.style.top).toBe('')
    expect(document.body.style.overflow).toBe('')
    expect(document.body.style.touchAction).toBe('')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 240)
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
    expect(action).toHaveClass('w-full')
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

  it('sizes full-screen mobile modals to the visual viewport', () => {
    setVisualViewport(390, 620, 24)

    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="full">
        Content
      </Modal>,
    )

    const overlay = document.body.querySelector('[role="dialog"]') as HTMLElement
    const modalCard = overlay.firstElementChild as HTMLElement

    // Overlay stays pinned to inset-0 (no inline top/height) so the
    // background always covers the full screen — prevents flash when keyboard appears.
    expect(overlay.style.top).toBe('')
    expect(overlay.style.height).toBe('')
    // The card itself shrinks to the visual viewport height
    expect(modalCard.style.height).toBe('620px')
  })

  it('centers mobile card modals within the keyboard-shrunken visual viewport', () => {
    setVisualViewport(390, 540, 0, 844)

    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="md">
        Content
      </Modal>,
    )

    const overlay = document.body.querySelector('[role="dialog"]') as HTMLElement
    const modalCard = overlay.firstElementChild as HTMLElement

    expect(overlay).toHaveClass('items-center')
    expect(overlay.style.paddingBottom).toBe('')
    expect(modalCard.style.maxHeight).toBe('516px')
  })

  it('caps mobile card modal height to stay inside the visible viewport', () => {
    setVisualViewport(390, 180, 0, 844)

    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" size="md">
        Content
      </Modal>,
    )

    const overlay = document.body.querySelector('[role="dialog"]') as HTMLElement
    const modalCard = overlay.firstElementChild as HTMLElement

    expect(overlay.style.height).toBe('180px')
    expect(modalCard.style.maxHeight).toBe('156px')
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

      const { rerender } = render(<Trigger />)
      const trigger = screen.getByTestId('trigger')

      // Focus the trigger, then open the modal
      trigger.focus()
      trigger.click()
      rerender(<Trigger />)

      // Wait for focus to move into modal
      await new Promise((resolve) => requestAnimationFrame(resolve))

      // The close button in the header gets focused
      const closeBtn = screen.getByLabelText('Close')
      expect(document.activeElement).toBe(closeBtn)

      // Close the modal
      closeBtn.click()
      rerender(<Trigger />)

      // Wait for focus restoration
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(document.activeElement).toBe(trigger)
    })
  })
})
