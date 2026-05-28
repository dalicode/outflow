import { describe, expect, it } from 'vitest'
import {
  getSplitBalanceTargetPreviews,
  getSplitPopoverTargetChildIds,
  getSplitRemainingAmount,
  isSplitBalanced,
  roundToCents,
} from '@/features/dashboard/utils/splitBalance'

describe('splitBalance', () => {
  it('rounds decimal values to cents', () => {
    expect(roundToCents(1.005)).toBe(1.01)
    expect(roundToCents(2.004)).toBe(2)
  })

  it('computes remaining amount with cent rounding', () => {
    expect(getSplitRemainingAmount(10, [3.33, 6.66])).toBe(0.01)
  })

  it('requires cent-rounded totals to match exactly by default', () => {
    expect(isSplitBalanced(10, [3.33, 6.66])).toBe(false)
    expect(isSplitBalanced(10, [3.33, 6.67])).toBe(true)
  })

  it('can apply an explicit cent-level tolerance', () => {
    expect(isSplitBalanced(10, [3.33, 6.66], 1)).toBe(true)
    expect(isSplitBalanced(10, [3.3, 6.6])).toBe(false)
  })

  it('returns only sibling rows for child edit popover targets', () => {
    const children = [
      { id: 1, date: '2026-01-01', amount: 1 },
      { id: 2, date: '2026-01-01', amount: 1 },
      { id: 3, date: '2026-01-01', amount: 1 },
    ]
    expect(
      getSplitPopoverTargetChildIds({
        children,
        editedExpenseId: 2,
        prioritizeSiblingsForChildEdit: true,
      }),
    ).toEqual([1, 3])
  })

  it('builds preview rows with before/after amounts and positive remaining', () => {
    const previews = getSplitBalanceTargetPreviews({
      containerAmount: 20,
      childAmountsById: { 1: 10, 2: 8 },
      targetChildIds: [2, 1],
      remainingAmount: 2,
    })

    expect(previews[0]).toMatchObject({
      expenseId: 2,
      currentAmount: 8,
      adjustmentAmount: 2,
      resultingAmount: 10,
      order: 0,
      isBalanced: true,
    })
    expect(previews[1].order).toBe(1)
  })

  it('builds preview rows for negative remaining reductions with cent rounding', () => {
    const previews = getSplitBalanceTargetPreviews({
      containerAmount: 18,
      childAmountsById: { 1: 10.005, 2: 9.005 },
      targetChildIds: [1],
      remainingAmount: -1.02,
    })

    expect(previews[0]).toMatchObject({
      expenseId: 1,
      currentAmount: 10.01,
      adjustmentAmount: -1.02,
      resultingAmount: 8.99,
      isBalanced: true,
    })
  })
})
