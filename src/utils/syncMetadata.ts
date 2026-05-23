import type { RecordSyncStatus, SyncMetadata } from '../types'

const DEVICE_ID_KEY = 'outflow.deviceId'

const isTestEnvironment = (): boolean => {
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
  } catch {
    return false
  }
}

const fallbackUuid = (): string => {
  if (isTestEnvironment()) {
    return '00000000-0000-4000-8000-000000000000'
  }

  const randomHex = (): string =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0')
  return `${randomHex()}-${randomHex().slice(0, 4)}-4${randomHex().slice(1, 4)}-8${randomHex().slice(0, 3)}-${randomHex()}${randomHex().slice(0, 4)}`
}

const createUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return fallbackUuid()
}

export function getDeviceId(): string {
  if (typeof localStorage === 'undefined') {
    return fallbackUuid()
  }

  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) {
    return existing
  }

  const next = createUuid()
  localStorage.setItem(DEVICE_ID_KEY, next)
  return next
}

export function normalizeNameForSync(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function createSyncMetadata(now: string = new Date().toISOString()): SyncMetadata {
  return {
    localId: createUuid(),
    cloudId: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'pending',
    lastSyncedAt: null,
    syncError: null,
    deviceId: getDeviceId(),
  }
}

type MetadataRecord = Partial<Omit<SyncMetadata, 'localId' | 'cloudId'>> & {
  localId?: string | null
  cloudId?: string | null
}

export function markRecordPending<T extends MetadataRecord>(
  record: T,
  now: string = new Date().toISOString(),
): T & Pick<SyncMetadata, 'updatedAt' | 'syncStatus' | 'syncError' | 'deviceId'> {
  return {
    ...record,
    updatedAt: now,
    syncStatus: 'pending' satisfies RecordSyncStatus,
    syncError: null,
    deviceId: getDeviceId(),
  }
}

export function markRecordDeleted<T extends MetadataRecord>(
  record: T,
  now: string = new Date().toISOString(),
): T & Pick<SyncMetadata, 'updatedAt' | 'syncStatus' | 'syncError' | 'deviceId' | 'deletedAt'> {
  return {
    ...markRecordPending(record, now),
    deletedAt: now,
  }
}

export function markRecordSynced<T extends MetadataRecord>(
  record: T,
  cloudFields?: { cloudId?: string | null; createdAt?: string; updatedAt?: string },
  now: string = new Date().toISOString(),
): T &
  Pick<SyncMetadata, 'syncStatus' | 'lastSyncedAt' | 'syncError'> &
  Partial<Pick<SyncMetadata, 'cloudId' | 'createdAt' | 'updatedAt'>> {
  return {
    ...record,
    ...cloudFields,
    syncStatus: 'synced',
    lastSyncedAt: now,
    syncError: null,
  }
}

export function markRecordFailed<T extends MetadataRecord>(
  record: T,
  error: string,
): T & Pick<SyncMetadata, 'syncStatus' | 'syncError' | 'deviceId'> {
  return {
    ...record,
    syncStatus: 'failed',
    syncError: error,
    deviceId: getDeviceId(),
  }
}

export function normalizeImportedSyncMetadata<T extends Record<string, unknown>>(
  record: T,
  options?: { now?: string; defaultStatus?: RecordSyncStatus; forcePending?: boolean },
): T & SyncMetadata {
  const now = options?.now ?? new Date().toISOString()
  const createdAt =
    typeof record.createdAt === 'string' && record.createdAt.length > 0 ? record.createdAt : now
  const updatedAt =
    typeof record.updatedAt === 'string' && record.updatedAt.length > 0
      ? record.updatedAt
      : createdAt

  const hasKnownSyncedState =
    record.syncStatus === 'synced' &&
    typeof record.lastSyncedAt === 'string' &&
    record.lastSyncedAt.length > 0

  const syncStatus: RecordSyncStatus = options?.forcePending
    ? 'pending'
    : record.syncStatus === 'pending' || record.syncStatus === 'failed'
      ? record.syncStatus
      : hasKnownSyncedState
        ? 'synced'
        : (options?.defaultStatus ?? 'pending')

  return {
    ...record,
    localId:
      typeof record.localId === 'string' && record.localId.length > 0
        ? record.localId
        : createUuid(),
    cloudId:
      typeof record.cloudId === 'string' && record.cloudId.length > 0 ? record.cloudId : null,
    createdAt,
    updatedAt,
    deletedAt:
      typeof record.deletedAt === 'string' && record.deletedAt.length > 0 ? record.deletedAt : null,
    syncStatus,
    lastSyncedAt:
      typeof record.lastSyncedAt === 'string' && record.lastSyncedAt.length > 0
        ? record.lastSyncedAt
        : null,
    syncError:
      typeof record.syncError === 'string' && record.syncError.length > 0 ? record.syncError : null,
    deviceId:
      typeof record.deviceId === 'string' && record.deviceId.length > 0
        ? record.deviceId
        : getDeviceId(),
  }
}
