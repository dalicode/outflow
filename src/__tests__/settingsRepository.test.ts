import { beforeEach, describe, expect, it, vi } from 'vitest'

type SettingRow = Record<string, unknown> & { key: string }

function createSettingsTable(initial: SettingRow[] = []) {
  let rows = [...initial]

  return {
    reset: () => {
      rows = []
    },
    seed: (nextRows: SettingRow[]) => {
      rows = [...nextRows]
    },
    rows: () => rows,
    toArray: async () => [...rows],
    get: async (key: string) => rows.find((row) => row.key === key),
    put: async (row: SettingRow) => {
      const index = rows.findIndex((entry) => entry.key === row.key)
      if (index >= 0) {
        rows[index] = { ...row }
      } else {
        rows.push({ ...row })
      }
      return row.key
    },
  }
}

const { settingsTable } = vi.hoisted(() => ({
  settingsTable: createSettingsTable(),
}))

vi.mock('../services/db/schema', () => ({
  default: {
    settings: settingsTable,
  },
}))

import { setLocalSetting } from '../services/repositories/settingsRepository'

describe('settingsRepository setLocalSetting', () => {
  beforeEach(() => {
    settingsTable.reset()
    vi.clearAllMocks()
  })

  it('creates local-only settings as synced rows', async () => {
    await setLocalSetting('localPrivacyModeEnabled', true)

    const row = settingsTable.rows()[0]
    expect(row.key).toBe('localPrivacyModeEnabled')
    expect(row.value).toBe(true)
    expect(row.syncStatus).toBe('synced')
    expect(row.lastSyncedAt).toEqual(expect.any(String))
    expect(row.syncError).toBeNull()
    expect(row.deletedAt).toBeNull()
  })

  it('normalizes existing local-only settings out of pending state on update', async () => {
    settingsTable.seed([
      {
        key: 'localPrivacyModeEnabled',
        value: false,
        localId: 'local-setting-1',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
        syncStatus: 'pending',
        lastSyncedAt: null,
        syncError: 'stale pending state',
        deviceId: 'device-1',
      },
    ])

    await setLocalSetting('localPrivacyModeEnabled', true)

    const row = settingsTable.rows()[0]
    expect(row.value).toBe(true)
    expect(row.syncStatus).toBe('synced')
    expect(row.lastSyncedAt).toEqual(expect.any(String))
    expect(row.syncError).toBeNull()
    expect(row.deletedAt).toBeNull()
  })
})
