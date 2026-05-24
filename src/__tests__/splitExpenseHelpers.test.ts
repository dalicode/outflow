import { describe, expect, it } from 'vitest'
import {
  distributeSplitAmountEvenly,
  getSplitContainerPayeeDisplay,
  reconcileSplitAmounts,
} from '../utils/splitExpenseHelpers'

describe('reconcileSplitAmounts', () => {
  it('returns balanced when totals match at precision', () => {
    const result = reconcileSplitAmounts(10, [3.33, 6.67], 2)
    expect(result.isBalanced).toBe(true)
    expect(result.difference).toBe(0)
    expect(result.childTotal).toBe(10)
  })

  it('returns remaining difference when under-allocated', () => {
    const result = reconcileSplitAmounts(10, [4, 5.5], 2)
    expect(result.isBalanced).toBe(false)
    expect(result.difference).toBe(0.5)
  })
})

describe('distributeSplitAmountEvenly', () => {
  it('splits evenly and puts remainder on the last row', () => {
    expect(distributeSplitAmountEvenly(10, 3, 2)).toEqual([3.33, 3.33, 3.34])
  })

  it('returns empty when child count is zero', () => {
    expect(distributeSplitAmountEvenly(10, 0, 2)).toEqual([])
  })
})

describe('getSplitContainerPayeeDisplay', () => {
  it('shows single payee when children share payee', () => {
    const label = getSplitContainerPayeeDisplay({
      childExpenses: [
        { date: '2026-01-01', amount: 20, payeeId: 1 },
        { date: '2026-01-01', amount: 30, payeeId: 1 },
      ],
      payees: [{ id: 1, name: 'Starbucks' }],
    })

    expect(label).toBe('Starbucks')
  })

  it('shows majority payee plus extra count', () => {
    const label = getSplitContainerPayeeDisplay({
      childExpenses: [
        { date: '2026-01-01', amount: 20, payeeId: 1 },
        { date: '2026-01-01', amount: 10, payeeId: 1 },
        { date: '2026-01-01', amount: 30, payeeId: 2 },
      ],
      payees: [
        { id: 1, name: 'Starbucks' },
        { id: 2, name: 'Uber' },
      ],
    })

    expect(label).toBe('Starbucks (+1 more)')
  })

  it('uses amount then name as deterministic tie-breakers', () => {
    const label = getSplitContainerPayeeDisplay({
      childExpenses: [
        { date: '2026-01-01', amount: 40, payeeNameSnapshot: 'Beta' },
        { date: '2026-01-01', amount: 10, payeeNameSnapshot: 'Alpha' },
      ],
      payees: [],
    })

    expect(label).toBe('Beta (+1 more)')
  })
})
