import { beforeEach, describe, expect, it, vi } from 'vitest'

const rangeSpy = vi.hoisted(() => vi.fn())
const upsertSpy = vi.hoisted(() => vi.fn())

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            range: (from: number, to: number) => rangeSpy(table, from, to),
          }),
        }),
      }),
      upsert: (rows: Array<Record<string, unknown>>, options: { onConflict: string }) =>
        upsertSpy(table, rows, options),
    }),
  },
}))

import { CLOUD_FETCH_PAGE_SIZE, SYNC_BATCH_SIZE } from '@/services/sync/constants'
import { fetchAllRowsForUser, upsertRowsInBatches } from '@/services/sync/supabaseUtils'

describe('supabaseUtils batching', () => {
  beforeEach(() => {
    rangeSpy.mockReset()
    upsertSpy.mockReset()
  })

  it('fetchAllRowsForUser pages cloud downloads in 500-row ranges', async () => {
    rangeSpy
      .mockResolvedValueOnce({
        data: Array.from({ length: CLOUD_FETCH_PAGE_SIZE }, (_, index) => ({ id: index + 1 })),
        error: null,
      })
      .mockResolvedValueOnce({
        data: Array.from({ length: 10 }, (_, index) => ({ id: CLOUD_FETCH_PAGE_SIZE + index + 1 })),
        error: null,
      })

    const rows = await fetchAllRowsForUser('expenses', 'user-1')

    expect(CLOUD_FETCH_PAGE_SIZE).toBe(500)
    expect(rows).toHaveLength(510)
    expect(rangeSpy).toHaveBeenNthCalledWith(1, 'expenses', 0, 499)
    expect(rangeSpy).toHaveBeenNthCalledWith(2, 'expenses', 500, 999)
  })

  it('upsertRowsInBatches uploads rows in 500-row chunks', async () => {
    upsertSpy.mockImplementation((_table, rows: Array<Record<string, unknown>>) => ({
      select: async () => ({ data: rows, error: null }),
    }))

    const input = Array.from({ length: 1201 }, (_, index) => ({
      local_id: `row-${index}`,
      user_id: 'user-1',
      updated_at: '2026-05-20T00:00:00.000Z',
    }))

    const result = await upsertRowsInBatches('expenses', input, 'user_id,local_id')

    expect(SYNC_BATCH_SIZE).toBe(500)
    expect(upsertSpy).toHaveBeenCalledTimes(3)
    expect(upsertSpy.mock.calls[0][1]).toHaveLength(500)
    expect(upsertSpy.mock.calls[1][1]).toHaveLength(500)
    expect(upsertSpy.mock.calls[2][1]).toHaveLength(201)
    expect(result).toHaveLength(1201)
  })

  it('separates rows with explicit cloud ids from new rows during upsert', async () => {
    upsertSpy.mockImplementation((_table, rows: Array<Record<string, unknown>>) => ({
      select: async () => ({ data: rows, error: null }),
    }))

    const result = await upsertRowsInBatches(
      'payees',
      [
        {
          id: 'cloud-payee-1',
          local_id: 'payee-1',
          user_id: 'user-1',
          name: 'Cafe',
          updated_at: '2026-05-20T00:00:00.000Z',
        },
        {
          local_id: 'payee-2',
          user_id: 'user-1',
          name: 'Market',
          updated_at: '2026-05-20T00:00:00.000Z',
        },
        {
          id: null,
          local_id: 'payee-3',
          user_id: 'user-1',
          name: 'Transit',
          updated_at: '2026-05-20T00:00:00.000Z',
        },
      ],
      'user_id,name',
    )

    expect(upsertSpy).toHaveBeenCalledTimes(2)
    expect(upsertSpy.mock.calls[0][1]).toEqual([
      expect.objectContaining({ id: 'cloud-payee-1', name: 'Cafe' }),
    ])
    expect(upsertSpy.mock.calls[1][1]).toEqual([
      expect.not.objectContaining({ id: expect.anything() }),
      expect.not.objectContaining({ id: expect.anything() }),
    ])
    expect(result).toHaveLength(3)
  })
})
