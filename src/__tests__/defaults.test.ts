import { describe, expect, it } from 'vitest'
import { buildDefaultCategories, buildDefaultPayees } from '../services/defaults'

describe('default entities', () => {
  it('creates sync-ready categories with cloud ids and timestamps', () => {
    const categories = buildDefaultCategories('2026-05-11T00:00:00.000Z')

    expect(categories[0]).toMatchObject({
      cloudId: expect.any(String),
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      isArchived: false,
    })
  })

  it('creates sync-ready payees with cloud ids and timestamps', () => {
    const payees = buildDefaultPayees('2026-05-11T00:00:00.000Z')

    expect(payees[0]).toMatchObject({
      cloudId: expect.any(String),
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      isArchived: false,
    })
  })
})
