import { describe, expect, it } from 'vitest'
import {
  getMostLikelyRelatedEntityId,
  getRecentEntityIds,
} from '../features/expenses/utils/entityHistory'

describe('entityHistory', () => {
  it('returns the most recent active entity ids', () => {
    const ids = getRecentEntityIds(
      [
        { date: '2026-05-01', categoryId: 1, payeeId: 10 },
        { date: '2026-05-03', categoryId: 2, payeeId: 11 },
        { date: '2026-05-02', categoryId: 1, payeeId: 12 },
      ],
      'categoryId',
      5,
      new Set([1, 2, 3]),
    )

    expect(ids).toEqual([2, 1])
  })

  it('finds the most likely related category for a payee', () => {
    const categoryId = getMostLikelyRelatedEntityId(
      [
        { date: '2026-05-01', categoryId: 4, payeeId: 8 },
        { date: '2026-05-03', categoryId: 3, payeeId: 8 },
        { date: '2026-05-02', categoryId: 4, payeeId: 8 },
        { date: '2026-05-04', categoryId: 9, payeeId: 2 },
      ],
      'payeeId',
      8,
      'categoryId',
      new Set([3, 4, 5, 6, 7, 8, 9]),
    )

    expect(categoryId).toBe(4)
  })
})
