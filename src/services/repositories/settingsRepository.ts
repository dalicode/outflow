import db from '../db/schema'
import { enqueue } from './common'

export async function getSetting<T>(key: string, fallback: T | null = null): Promise<T | null> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const updatedAt = new Date().toISOString()
  await db.settings.put({ key, value, updatedAt })
  await enqueue('settings', 'upsert', { key, value })
}

export async function setLocalSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value, updatedAt: new Date().toISOString() })
}
