import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Strip from '../components/ui/Strip'

vi.mock('../hooks/useHaptics', () => ({
  useHaptics: () => ({
    selection: vi.fn(),
    light: vi.fn(),
    medium: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}))

function setRect(element: Element, left: number, width = 40) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        left,
        right: left + width,
        top: 0,
        bottom: 24,
        width,
        height: 24,
      }) as DOMRect,
  })
}

describe('Strip', () => {
  it('keeps the selected item in view when selectedKey changes', () => {
    const scrollTo = vi.fn()

    const { container, rerender } = render(
      <Strip
        maxVisible={3}
        scrollClass="month-strip-scroll"
        scrollSelector="[data-selected='true']"
        selectedKey="jan"
        currentLabel="Current"
        stepBackLabel="Previous"
        stepForwardLabel="Next"
      >
        <button data-selected="true">Jan</button>
        <button>Feb</button>
        <button>Mar</button>
        <button>Apr</button>
      </Strip>,
    )

    const scrollContainer = container.querySelector('.month-strip-scroll') as HTMLDivElement
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 120 })
    Object.defineProperty(scrollContainer, 'scrollWidth', { configurable: true, value: 240 })
    Object.defineProperty(scrollContainer, 'scrollLeft', {
      configurable: true,
      writable: true,
      value: 0,
    })
    Object.defineProperty(scrollContainer, 'scrollTo', {
      configurable: true,
      value: ({ left }: { left: number }) => {
        scrollContainer.scrollLeft = left
        scrollTo(left)
      },
    })

    setRect(scrollContainer, 0, 120)
    const [jan, feb, mar, apr] = scrollContainer.querySelectorAll('button')
    setRect(jan, 0)
    setRect(feb, 40)
    setRect(mar, 80)
    setRect(apr, 160)

    rerender(
      <Strip
        maxVisible={3}
        scrollClass="month-strip-scroll"
        scrollSelector="[data-selected='true']"
        selectedKey="apr"
        currentLabel="Current"
        stepBackLabel="Previous"
        stepForwardLabel="Next"
      >
        <button>Jan</button>
        <button>Feb</button>
        <button>Mar</button>
        <button data-selected="true">Apr</button>
      </Strip>,
    )

    expect(scrollTo).toHaveBeenCalled()
    expect(scrollContainer.scrollLeft).toBeGreaterThan(0)
  })
})
