import { describe, expect, it, vi } from 'vitest'
import { editableCellActivate } from '../features/dashboard/expenseColumns'

describe('editableCellActivate', () => {
  it('returns pointer down handler that triggers edit on left-click', () => {
    const switchCellEdit = vi.fn()
    const editing = {
      switchCellEdit,
    } as unknown as Parameters<typeof editableCellActivate>[0]

    const handlers = editableCellActivate(
      editing,
      { id: 1 } as Parameters<typeof editableCellActivate>[1],
      'description',
    )

    // The returned handler set should include onPointerDown but NOT onClick
    expect(typeof handlers.onPointerDown).toBe('function')
    expect((handlers as Record<string, unknown>).onClick).toBeUndefined()

    // Simulate a primary pointer down on a cell element
    handlers.onPointerDown?.({
      button: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: document.createElement('span'),
    } as unknown as React.PointerEvent<HTMLElement>)

    expect(switchCellEdit).toHaveBeenCalledTimes(1)
    expect(switchCellEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'description')
  })

  it('ignores right-clicks and cells inside no-cell-switch containers', () => {
    const switchCellEdit = vi.fn()
    const editing = {
      switchCellEdit,
    } as unknown as Parameters<typeof editableCellActivate>[0]

    const handlers = editableCellActivate(
      editing,
      { id: 1 } as Parameters<typeof editableCellActivate>[1],
      'payeeId',
    )

    // Right-click does NOT trigger
    handlers.onPointerDown?.({
      button: 2,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: document.createElement('span'),
    } as unknown as React.PointerEvent<HTMLElement>)
    expect(switchCellEdit).not.toHaveBeenCalled()

    // Left-click inside a [data-no-cell-switch] container does NOT trigger
    const container = document.createElement('div')
    container.setAttribute('data-no-cell-switch', '')
    const nestedSpan = document.createElement('span')
    container.appendChild(nestedSpan)

    handlers.onPointerDown?.({
      button: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: nestedSpan,
    } as unknown as React.PointerEvent<HTMLElement>)
    expect(switchCellEdit).not.toHaveBeenCalled()

    // Left-click on a normal element DOES trigger
    handlers.onPointerDown?.({
      button: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: document.createElement('span'),
    } as unknown as React.PointerEvent<HTMLElement>)
    expect(switchCellEdit).toHaveBeenCalledTimes(1)
  })
})
