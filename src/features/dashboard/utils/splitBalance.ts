import type { Expense } from '../../../types'

const CENTS_EPSILON = 0.000001

export function roundToCents(amount: number): number {
  return Math.round((amount + CENTS_EPSILON) * 100) / 100
}

export function getSplitRemainingAmount(containerAmount: number, childAmounts: number[]): number {
  const roundedContainer = roundToCents(containerAmount)
  const roundedChildrenTotal = roundToCents(
    childAmounts.reduce((sum, amount) => sum + roundToCents(amount), 0),
  )
  return roundToCents(roundedContainer - roundedChildrenTotal)
}

export function isSplitBalanced(
  containerAmount: number,
  childAmounts: number[],
  toleranceCents = 0,
): boolean {
  const remaining = getSplitRemainingAmount(containerAmount, childAmounts)
  return Math.abs(remaining) <= toleranceCents / 100
}

export function getSplitPopoverTargetChildIds(params: {
  children: Expense[]
  editedExpenseId?: number
  prioritizeSiblingsForChildEdit: boolean
}): number[] {
  const { children, editedExpenseId, prioritizeSiblingsForChildEdit } = params
  const childIds = children
    .map((child) => child.id)
    .filter((id): id is number => typeof id === 'number')

  if (!prioritizeSiblingsForChildEdit || typeof editedExpenseId !== 'number') {
    return childIds
  }

  return childIds.filter((id) => id !== editedExpenseId)
}

export interface SplitBalanceTargetPreview {
  expenseId: number
  currentAmount: number
  adjustmentAmount: number
  resultingAmount: number
  order: number
  isBalanced: boolean
}

export function getSplitBalanceTargetPreviews(params: {
  containerAmount: number
  childAmountsById: Record<number, number>
  targetChildIds: number[]
  remainingAmount: number
}): SplitBalanceTargetPreview[] {
  const { containerAmount, childAmountsById, targetChildIds, remainingAmount } = params

  return targetChildIds.map((expenseId, order) => {
    const currentAmount = roundToCents(childAmountsById[expenseId] ?? 0)
    const resultingAmount = roundToCents(currentAmount + remainingAmount)
    const nextChildAmounts = { ...childAmountsById, [expenseId]: resultingAmount }
    const isBalanced = isSplitBalanced(containerAmount, Object.values(nextChildAmounts))

    return {
      expenseId,
      currentAmount,
      adjustmentAmount: roundToCents(remainingAmount),
      resultingAmount,
      order,
      isBalanced,
    }
  })
}
