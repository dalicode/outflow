import type { SyncedSettingRow } from '../../types'
import { markRecordSynced } from '../../utils/syncMetadata'
import db from '../db/schema'
import { buildCreatedSyncRecord, filterActiveRows, markPendingActiveRecord } from './common'

function buildLocalOnlySettingRow(
  key: string,
  value: unknown,
  now: string,
  existing?: SyncedSettingRow,
): SyncedSettingRow {
  if (existing) {
    return {
      ...existing,
      ...markRecordSynced(existing, undefined, now),
      key,
      value,
      updatedAt: now,
      deletedAt: null,
    }
  }

  return {
    ...markRecordSynced(
      buildCreatedSyncRecord(
        {
          key,
          value,
          updatedAt: now,
        },
        now,
      ) as SyncedSettingRow,
      undefined,
      now,
    ),
    key,
    value,
    updatedAt: now,
    deletedAt: null,
  }
}

export async function getAllSettingsRows(): Promise<SyncedSettingRow[]> {
  return db.settings.toArray()
}

export async function getSettingsRows(): Promise<SyncedSettingRow[]> {
  return filterActiveRows(await getAllSettingsRows())
}

export async function getSetting<T>(key: string, fallback: T | null = null): Promise<T | null> {
  const row = await db.settings.get(key)
  if (!row || row.deletedAt != null) return fallback
  return row.value as T
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const existing = await db.settings.get(key)
  const now = new Date().toISOString()
  if (existing) {
    await db.settings.put({
      ...existing,
      ...markPendingActiveRecord(existing, now),
      key,
      value,
      updatedAt: now,
      deletedAt: null,
    })
    return
  }

  await db.settings.put(
    buildCreatedSyncRecord(
      {
        key,
        value,
        updatedAt: now,
      },
      now,
    ) as SyncedSettingRow,
  )
}

export async function setLocalSetting(key: string, value: unknown): Promise<void> {
  const existing = await db.settings.get(key)
  const now = new Date().toISOString()
  await db.settings.put(buildLocalOnlySettingRow(key, value, now, existing))
}
