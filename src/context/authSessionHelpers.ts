export function shouldInvalidateSyncRunOnAuthTransition(
  previousUserId: string | null,
  nextUserId: string | null,
): boolean {
  return (
    (previousUserId != null && nextUserId == null) ||
    (previousUserId != null && nextUserId != null && previousUserId !== nextUserId)
  )
}

export function isIgnorableStartupSyncError(
  error: unknown,
  isOffline: boolean,
  staleSyncRunMessage?: string,
): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const normalizedMessage = message.toLowerCase()

  if (staleSyncRunMessage && message === staleSyncRunMessage) return true
  if (isOffline) return true

  return (
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('networkerror') ||
    normalizedMessage.includes('network error') ||
    normalizedMessage.includes('network request failed') ||
    normalizedMessage.includes('load failed') ||
    normalizedMessage.includes('the network connection was lost') ||
    normalizedMessage.includes('network timeout') ||
    normalizedMessage.includes('timeout')
  )
}

export function resolveStartupSyncReason(authEvent: string | null): 'sign-in' | 'startup' {
  return authEvent === 'SIGNED_IN' ? 'sign-in' : 'startup'
}
