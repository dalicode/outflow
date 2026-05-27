import { describe, expect, it } from 'vitest'
import {
  isIgnorableStartupSyncError,
  resolveStartupSyncReason,
  shouldInvalidateSyncRunOnAuthTransition,
} from '../context/authSessionHelpers'

describe('shouldInvalidateSyncRunOnAuthTransition', () => {
  it('invalidates when the user signs out', () => {
    expect(shouldInvalidateSyncRunOnAuthTransition('user-1', null)).toBe(true)
  })

  it('invalidates when the signed-in user changes', () => {
    expect(shouldInvalidateSyncRunOnAuthTransition('user-1', 'user-2')).toBe(true)
  })

  it('does not invalidate when there is no user transition to clear', () => {
    expect(shouldInvalidateSyncRunOnAuthTransition(null, null)).toBe(false)
    expect(shouldInvalidateSyncRunOnAuthTransition(null, 'user-1')).toBe(false)
    expect(shouldInvalidateSyncRunOnAuthTransition('user-1', 'user-1')).toBe(false)
  })
})

describe('isIgnorableStartupSyncError', () => {
  it('ignores stale sync run cancellation errors', () => {
    expect(isIgnorableStartupSyncError('stale-sync-run', false, 'stale-sync-run')).toBe(true)
    expect(isIgnorableStartupSyncError(new Error('stale-sync-run'), false, 'stale-sync-run')).toBe(
      true,
    )
  })

  it('ignores startup sync errors when offline', () => {
    expect(isIgnorableStartupSyncError('any-error', true)).toBe(true)
  })

  it('ignores known network interruption messages', () => {
    expect(isIgnorableStartupSyncError('Failed to fetch', false)).toBe(true)
    expect(isIgnorableStartupSyncError('Network request failed', false)).toBe(true)
    expect(isIgnorableStartupSyncError('the network connection was lost', false)).toBe(true)
  })

  it('does not ignore non-network errors', () => {
    expect(isIgnorableStartupSyncError('permission denied', false)).toBe(false)
  })
})

describe('resolveStartupSyncReason', () => {
  it('uses sign-in reason for sign-in events and startup for everything else', () => {
    expect(resolveStartupSyncReason('SIGNED_IN')).toBe('sign-in')
    expect(resolveStartupSyncReason('INITIAL_SESSION')).toBe('startup')
    expect(resolveStartupSyncReason(null)).toBe('startup')
  })
})
