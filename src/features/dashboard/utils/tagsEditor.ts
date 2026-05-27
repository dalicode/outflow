import type { Tag } from '../../../types'

export function getTagsAnchorRect(anchorElement: HTMLElement): DOMRect {
  const tableCell = anchorElement.closest('td')
  if (tableCell instanceof HTMLTableCellElement) {
    return tableCell.getBoundingClientRect()
  }
  return anchorElement.getBoundingClientRect()
}

export function findTagsAnchorElement(expenseId: number): HTMLElement | null {
  const target = document.querySelector(`[data-expense-id="${expenseId}"][data-field="tags"]`)
  return target instanceof HTMLElement ? target : null
}

export function getTagIds(tags: Tag[]): number[] {
  return tags.map((tag) => tag.id).filter((tagId): tagId is number => typeof tagId === 'number')
}

export function haveSameTagIds(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  if (leftSet.size !== rightSet.size) return false
  return left.every((tagId) => rightSet.has(tagId))
}
