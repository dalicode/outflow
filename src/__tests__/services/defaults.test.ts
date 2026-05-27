import { describe, expect, it } from 'vitest'
import { buildDefaultCategories, buildDefaultPayees } from '@/services/defaults'

describe('default entities', () => {
  it('creates categories with sync metadata and normalized names', () => {
    const categories = buildDefaultCategories('2026-05-11T00:00:00.000Z')

    expect(categories[0]).toMatchObject({
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'pending',
      cloudId: null,
      lastSyncedAt: null,
      syncError: null,
      isArchived: false,
      normalizedName: categories[0].name.toLowerCase(),
    })
    expect(typeof categories[0].localId).toBe('string')
    expect(categories[0].localId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    const ids = categories.map((c) => c.localId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('creates payees with sync metadata and normalized names', () => {
    const payees = buildDefaultPayees('2026-05-11T00:00:00.000Z')

    expect(payees[0]).toMatchObject({
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'pending',
      cloudId: null,
      lastSyncedAt: null,
      syncError: null,
      isArchived: false,
      normalizedName: payees[0].name.toLowerCase(),
    })
    expect(typeof payees[0].localId).toBe('string')
    expect(payees[0].localId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    const ids = payees.map((p) => p.localId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
