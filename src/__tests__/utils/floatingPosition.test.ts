import { describe, expect, it, vi } from 'vitest'
import { getCalendarFloatingPosition, getDropdownFloatingPosition } from '@/utils/floatingPosition'

function makeRect({
  top,
  bottom,
  left = 40,
  width = 280,
}: {
  top: number
  bottom: number
  left?: number
  width?: number
}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    bottom,
    left,
    right: left + width,
    width,
    height: bottom - top,
    toJSON: () => ({}),
  } as DOMRect
}

describe('getDropdownFloatingPosition', () => {
  it('prefers below when usable space exists below', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 900)

    const pos = getDropdownFloatingPosition(makeRect({ top: 120, bottom: 160 }), {
      idealHeight: 300,
      maxHeight: 420,
      minUsableHeight: 120,
      gap: 4,
    })

    expect(pos.placement).toBe('bottom')
    expect(pos.top).toBe(164)
    expect(pos.maxHeight).toBe(420)
  })

  it('opens above when below is usable but above can fit the full height', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 550)

    const pos = getDropdownFloatingPosition(makeRect({ top: 330, bottom: 370 }), {
      idealHeight: 300,
      maxHeight: 420,
      minUsableHeight: 120,
      gap: 4,
    })

    expect(pos.placement).toBe('top')
    expect(pos.bottom).toBe(224)
    expect(pos.maxHeight).toBe(318)
  })

  it('flips above when below is too constrained and above has more room', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 580)

    const pos = getDropdownFloatingPosition(makeRect({ top: 500, bottom: 540 }), {
      idealHeight: 300,
      maxHeight: 420,
      minUsableHeight: 120,
      gap: 4,
    })

    expect(pos.placement).toBe('top')
    expect(pos.bottom).toBe(84)
    expect(pos.maxHeight).toBe(420)
  })

  it('chooses the larger side when neither side fits the ideal height', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 220)

    const pos = getDropdownFloatingPosition(makeRect({ top: 90, bottom: 130 }), {
      idealHeight: 120,
      maxHeight: 420,
      minUsableHeight: 120,
      gap: 4,
    })

    expect(pos.placement).toBe('bottom')
    expect(pos.maxHeight).toBe(78)
  })

  it('clamps width and left position to the viewport', () => {
    vi.stubGlobal('innerWidth', 320)
    vi.stubGlobal('innerHeight', 900)

    const pos = getDropdownFloatingPosition(
      makeRect({ top: 120, bottom: 160, left: 220, width: 180 }),
      {
        desiredWidth: 420,
        maxWidth: 420,
        minWidth: 240,
        gap: 4,
      },
    )

    expect(pos.left).toBe(8)
    expect(pos.width).toBe(304)
  })
})

describe('getCalendarFloatingPosition', () => {
  it('opens below when the full calendar fits below', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 900)

    const pos = getCalendarFloatingPosition(makeRect({ top: 120, bottom: 160 }), {
      idealHeight: 320,
      maxHeight: 320,
      gap: 4,
    })

    expect(pos.placement).toBe('bottom')
    expect(pos.top).toBe(164)
    expect(pos.maxHeight).toBe(320)
  })

  it('opens above when below does not fit but above does', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 620)

    const pos = getCalendarFloatingPosition(makeRect({ top: 520, bottom: 560 }), {
      idealHeight: 320,
      maxHeight: 320,
      gap: 4,
    })

    expect(pos.placement).toBe('top')
    expect(pos.bottom).toBe(104)
    expect(pos.maxHeight).toBe(320)
  })

  it('chooses the larger side when neither side fits the full calendar', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 400)

    const pos = getCalendarFloatingPosition(makeRect({ top: 170, bottom: 210 }), {
      idealHeight: 320,
      maxHeight: 320,
      gap: 4,
    })

    expect(pos.placement).toBe('bottom')
    expect(pos.maxHeight).toBe(178)
  })

  it('returns a top-placement bottom pin instead of a guessed top offset', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 620)

    const pos = getCalendarFloatingPosition(makeRect({ top: 520, bottom: 560 }), {
      idealHeight: 320,
      maxHeight: 320,
      gap: 4,
    })

    expect(pos.top).toBeUndefined()
    expect(pos.bottom).toBe(104)
  })
})
