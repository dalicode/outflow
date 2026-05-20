export type FloatingPlacement = 'bottom' | 'top'

export interface FloatingPosition {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
  availableHeight: number
  placement: FloatingPlacement
}

export interface FloatingPositionOptions {
  preferredPlacement?: FloatingPlacement
  idealHeight?: number
  minUsableHeight?: number
  maxHeight?: number
  preferFullHeightPlacement?: boolean
  minWidth?: number
  maxWidth?: number
  desiredWidth?: number
  matchTriggerWidth?: boolean
  viewportMargin?: number
  gap?: number
}

function getClampedWidth(anchorRect: DOMRect, options: FloatingPositionOptions): {
  left: number
  width: number
} {
  const {
    minWidth = 0,
    maxWidth = Number.POSITIVE_INFINITY,
    desiredWidth,
    matchTriggerWidth = false,
    viewportMargin = 8,
  } = options

  const viewportWidth = window.innerWidth
  const availableViewportWidth = Math.max(0, viewportWidth - viewportMargin * 2)
  const rawWidth =
    desiredWidth ??
    (matchTriggerWidth ? anchorRect.width : Math.max(minWidth, anchorRect.width))
  const width = Math.min(maxWidth, rawWidth, availableViewportWidth)
  const left = Math.min(
    Math.max(anchorRect.left, viewportMargin),
    viewportWidth - viewportMargin - width,
  )

  return { left, width }
}

function getViewportSpace(anchorRect: DOMRect, viewportMargin: number, gap: number): {
  above: number
  below: number
} {
  return {
    above: Math.max(anchorRect.top - viewportMargin - gap, 0),
    below: Math.max(window.innerHeight - anchorRect.bottom - viewportMargin - gap, 0),
  }
}

function toFloatingPosition(
  anchorRect: DOMRect,
  placement: FloatingPlacement,
  width: number,
  left: number,
  maxHeight: number,
  gap: number,
): FloatingPosition {
  if (placement === 'bottom') {
    return {
      top: anchorRect.bottom + gap,
      left,
      width,
      maxHeight,
      availableHeight: maxHeight,
      placement,
    }
  }

  return {
    bottom: window.innerHeight - anchorRect.top + gap,
    left,
    width,
    maxHeight,
    availableHeight: maxHeight,
    placement,
  }
}

export function getDropdownFloatingPosition(
  anchorRect: DOMRect,
  options: FloatingPositionOptions = {},
): FloatingPosition {
  const {
    preferredPlacement = 'bottom',
    idealHeight = 320,
    minUsableHeight = 120,
    maxHeight = 420,
    preferFullHeightPlacement = true,
    viewportMargin = 8,
    gap = 4,
  } = options

  const { left, width } = getClampedWidth(anchorRect, options)
  const { above, below } = getViewportSpace(anchorRect, viewportMargin, gap)
  const availableBelow = Math.min(maxHeight, below)
  const availableAbove = Math.min(maxHeight, above)
  const resolvedIdealHeight = Math.min(idealHeight, maxHeight)

  let placement: FloatingPlacement = preferredPlacement

  if (preferredPlacement === 'bottom') {
    if (below >= resolvedIdealHeight) {
      placement = 'bottom'
    } else if (preferFullHeightPlacement && above >= resolvedIdealHeight) {
      placement = 'top'
    } else if (availableBelow >= minUsableHeight) {
      placement = 'bottom'
    } else if (availableAbove > availableBelow) {
      placement = 'top'
    } else {
      placement = 'bottom'
    }
  } else if (above >= resolvedIdealHeight) {
    placement = 'top'
  } else if (preferFullHeightPlacement && below >= resolvedIdealHeight) {
    placement = 'bottom'
  } else if (availableAbove >= minUsableHeight) {
    placement = 'top'
  } else if (availableBelow > availableAbove) {
    placement = 'bottom'
  } else {
    placement = 'top'
  }

  const availableHeight = placement === 'bottom' ? availableBelow : availableAbove
  const resolvedMaxHeight = Math.max(0, Math.min(maxHeight, availableHeight))

  return toFloatingPosition(anchorRect, placement, width, left, resolvedMaxHeight, gap)
}

export function getCalendarFloatingPosition(
  anchorRect: DOMRect,
  options: FloatingPositionOptions = {},
): FloatingPosition {
  const {
    preferredPlacement = 'bottom',
    idealHeight = 320,
    minUsableHeight = 240,
    maxHeight = idealHeight,
    viewportMargin = 8,
    gap = 4,
  } = options

  const { left, width } = getClampedWidth(anchorRect, options)
  const { above, below } = getViewportSpace(anchorRect, viewportMargin, gap)
  const availableBelow = Math.min(maxHeight, below)
  const availableAbove = Math.min(maxHeight, above)
  const fullCalendarHeight = Math.min(idealHeight, maxHeight)

  let placement: FloatingPlacement

  if (preferredPlacement === 'bottom') {
    if (below >= fullCalendarHeight) {
      placement = 'bottom'
    } else if (above >= fullCalendarHeight) {
      placement = 'top'
    } else {
      placement = availableAbove > availableBelow ? 'top' : 'bottom'
    }
  } else if (above >= fullCalendarHeight) {
    placement = 'top'
  } else if (below >= fullCalendarHeight) {
    placement = 'bottom'
  } else {
    placement = availableBelow >= availableAbove ? 'bottom' : 'top'
  }

  const availableHeight = placement === 'bottom' ? availableBelow : availableAbove
  const resolvedMaxHeight = Math.max(Math.min(minUsableHeight, availableHeight), availableHeight)

  return toFloatingPosition(anchorRect, placement, width, left, resolvedMaxHeight, gap)
}
