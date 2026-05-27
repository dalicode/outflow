import { beforeEach, describe, expect, it, vi } from 'vitest'

type QueueRow = {
  id?: number
  table: string
  operation: 'insert' | 'update' | 'delete' | 'upsert'
  payload: Record<string, unknown>
  timestamp: number
}

function createSyncQueueTable(initial: QueueRow[] = []) {
  let rows = [...initial]
  let nextId = 1

  return {
    reset: () => {
      rows = []
      nextId = 1
    },
    seed: (nextRows: QueueRow[]) => {
      rows = nextRows.map((row) => ({ ...row }))
      const numericIds = rows
        .map((row) => row.id)
        .filter((id): id is number => typeof id === 'number')
      nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1
    },
    rows: () => rows.map((row) => ({ ...row })),
    toArray: async () => rows.map((row) => ({ ...row })),
    clear: async () => {
      rows = []
    },
    bulkAdd: async (records: QueueRow[]) => {
      for (const record of records) {
        rows.push({ ...record, id: nextId++ })
      }
    },
    add: async (record: QueueRow) => {
      const id = nextId++
      rows.push({ ...record, id })
      return id
    },
  }
}

const { syncQueue, transaction, pauseSync, resumeSync } = vi.hoisted(() => ({
  syncQueue: createSyncQueueTable(),
  transaction: vi.fn(async (_mode: string, _table: unknown, callback: () => Promise<void>) => {
    await callback()
  }),
  pauseSync: vi.fn(),
  resumeSync: vi.fn(),
}))

vi.mock('@/services/db/schema', () => ({
  default: {
    syncQueue,
    transaction,
  },
}))

vi.mock('@/services/syncRuntime', () => ({
  FULL_SYNC_QUEUE_TABLE: '__full_sync__',
  pauseSync,
  resumeSync,
}))

import { queueImportSyncMarker, runLocalImport } from '@/services/importService'

describe('importService', () => {
  beforeEach(() => {
    syncQueue.reset()
    vi.clearAllMocks()
  })

  it('collapses import markers into a single full-sync marker while preserving delete entries', async () => {
    syncQueue.seed([
      {
        id: 1,
        table: '__full_sync__',
        operation: 'upsert',
        payload: { reason: 'backup-import', replace: false },
        timestamp: 10,
      },
      {
        id: 2,
        table: 'expenses',
        operation: 'delete',
        payload: { id: 99 },
        timestamp: 11,
      },
      {
        id: 3,
        table: 'expenses',
        operation: 'update',
        payload: { id: 100 },
        timestamp: 12,
      },
    ])

    await queueImportSyncMarker(
      { reason: 'backup-import', replace: true },
      { preserveDeletesOnly: true },
    )

    expect(syncQueue.rows()).toEqual([
      expect.objectContaining({
        table: 'expenses',
        operation: 'delete',
        payload: { id: 99 },
      }),
      expect.objectContaining({
        table: '__full_sync__',
        operation: 'upsert',
        payload: { reason: 'backup-import', replace: true },
      }),
    ])
  })

  it('pauses sync during local import work, then resumes and triggers one follow-up sync', async () => {
    const events: string[] = []
    const onRefreshAll = vi.fn(async () => {
      events.push('refresh')
    })
    const onStatus = vi.fn((status: string) => {
      events.push(status)
    })
    const triggerSync = vi.fn(() => {
      events.push('trigger')
    })

    await runLocalImport({
      pauseReason: 'import',
      runLocalWrite: async () => {
        events.push('write-start')
        expect(pauseSync).toHaveBeenCalledWith('import')
        expect(resumeSync).not.toHaveBeenCalled()
        events.push('write-end')
      },
      onRefreshAll,
      onStatus,
      triggerSync,
      hasCloudSync: true,
      importingStatus: 'Importing backup locally…',
      importedCloudStatus: 'Backup imported locally. Cloud sync queued in the background.',
    })

    expect(pauseSync).toHaveBeenCalledWith('import')
    expect(resumeSync).toHaveBeenCalledWith('import')
    expect(onRefreshAll).toHaveBeenCalledTimes(1)
    expect(triggerSync).toHaveBeenCalledTimes(1)
    expect(events).toEqual([
      'Importing backup locally…',
      'write-start',
      'write-end',
      'refresh',
      'Backup imported locally. Cloud sync queued in the background.',
      'trigger',
    ])
  })
})
