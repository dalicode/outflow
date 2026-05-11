import { describe, expect, it } from 'vitest'
import { buildDefaultCategories, buildDefaultPayees } from '../services/defaults'

describe('default entities', () => {
  it('creates categories with timestamps and a stable cloudId', () => {
    const categories = buildDefaultCategories('2026-05-11T00:00:00.000Z')

    expect(categories[0]).toMatchObject({
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      isArchived: false,
    })
    // Each seeded category must have a UUID cloudId so it syncs correctly
    expect(typeof categories[0].cloudId).toBe('string')
    expect(categories[0].cloudId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    // Each category gets a unique cloudId
    const ids = categories.map((c) => c.cloudId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('creates payees with timestamps and a stable cloudId', () => {
    const payees = buildDefaultPayees('2026-05-11T00:00:00.000Z')

    expect(payees[0]).toMatchObject({
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      isArchived: false,
    })
    // Each seeded payee must have a UUID cloudId
    expect(typeof payees[0].cloudId).toBe('string')
    expect(payees[0].cloudId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    // Each payee gets a unique cloudId
    const ids = payees.map((p) => p.cloudId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
