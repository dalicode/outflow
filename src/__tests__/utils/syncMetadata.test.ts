import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSyncMetadata,
  getDeviceId,
  markRecordDeleted,
  markRecordFailed,
  markRecordPending,
  markRecordSynced,
  normalizeImportedSyncMetadata,
  normalizeNameForSync,
} from '@/utils/syncMetadata'

describe('syncMetadata helpers', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('stores and reuses device id in localStorage', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')

    const first = getDeviceId()
    const second = getDeviceId()

    expect(first).toBe('11111111-1111-4111-8111-111111111111')
    expect(second).toBe(first)
    expect(localStorage.getItem('outflow.deviceId')).toBe(first)
  })

  it('normalizes names for sync matching', () => {
    expect(normalizeNameForSync('  Tim   Hortons  ')).toBe('tim hortons')
  })

  it('creates sync metadata with pending status', () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')

    const row = createSyncMetadata('2026-05-01T00:00:00.000Z')

    expect(row).toMatchObject({
      localId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      cloudId: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'pending',
      lastSyncedAt: null,
      syncError: null,
      deviceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    })
  })

  it('marks record pending and clears previous syncError', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('cccccccc-cccc-4ccc-8ccc-cccccccccccc')

    const next = markRecordPending(
      {
        localId: 'x',
        syncStatus: 'failed' as const,
        syncError: 'network',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
      '2026-05-02T00:00:00.000Z',
    )

    expect(next.syncStatus).toBe('pending')
    expect(next.syncError).toBeNull()
    expect(next.updatedAt).toBe('2026-05-02T00:00:00.000Z')
    expect(next.deviceId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  })

  it('marks record deleted as tombstone', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('dddddddd-dddd-4ddd-8ddd-dddddddddddd')

    const next = markRecordDeleted({ localId: 'x' }, '2026-05-03T00:00:00.000Z')

    expect(next.deletedAt).toBe('2026-05-03T00:00:00.000Z')
    expect(next.syncStatus).toBe('pending')
  })

  it('marks record synced and preserves timestamps from cloud when provided', () => {
    const next = markRecordSynced(
      {
        localId: 'x',
        syncStatus: 'pending' as const,
      },
      {
        cloudId: 'cloud-123',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      '2026-05-04T01:00:00.000Z',
    )

    expect(next.syncStatus).toBe('synced')
    expect(next.cloudId).toBe('cloud-123')
    expect(next.lastSyncedAt).toBe('2026-05-04T01:00:00.000Z')
    expect(next.syncError).toBeNull()
  })

  it('marks record failed with readable sync error without mutating business updatedAt', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')

    const next = markRecordFailed(
      { localId: 'x', updatedAt: '2026-01-01T00:00:00.000Z' },
      'Conflict',
    )

    expect(next.syncStatus).toBe('failed')
    expect(next.syncError).toBe('Conflict')
    expect(next.updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('normalizes legacy imported row metadata', () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('ffffffff-ffff-4fff-8fff-ffffffffffff')
      .mockReturnValueOnce('99999999-9999-4999-8999-999999999999')

    const row = normalizeImportedSyncMetadata(
      {
        name: 'Legacy Row',
      },
      { now: '2026-05-06T00:00:00.000Z' },
    )

    expect(row.localId).toBe('ffffffff-ffff-4fff-8fff-ffffffffffff')
    expect(row.cloudId).toBeNull()
    expect(row.createdAt).toBe('2026-05-06T00:00:00.000Z')
    expect(row.updatedAt).toBe('2026-05-06T00:00:00.000Z')
    expect(row.deletedAt).toBeNull()
    expect(row.syncStatus).toBe('pending')
    expect(row.lastSyncedAt).toBeNull()
    expect(row.syncError).toBeNull()
    expect(row.deviceId).toBe('99999999-9999-4999-8999-999999999999')
  })

  it('keeps explicit synced import state unless forcePending is true', () => {
    const synced = normalizeImportedSyncMetadata({
      localId: 'existing',
      syncStatus: 'synced',
      lastSyncedAt: '2026-05-01T00:00:00.000Z',
    })

    expect(synced.syncStatus).toBe('synced')

    const forced = normalizeImportedSyncMetadata(
      {
        localId: 'existing',
        syncStatus: 'synced',
        lastSyncedAt: '2026-05-01T00:00:00.000Z',
      },
      { forcePending: true },
    )

    expect(forced.syncStatus).toBe('pending')
  })

  it('preserves explicit failed import state and sync error metadata', () => {
    const failed = normalizeImportedSyncMetadata({
      localId: 'existing',
      syncStatus: 'failed',
      syncError: 'Network timeout',
    })

    expect(failed.syncStatus).toBe('failed')
    expect(failed.syncError).toBe('Network timeout')
  })
})
