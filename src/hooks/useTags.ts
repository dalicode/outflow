import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'
import { StorageService } from '../services/storageService'

export function useTags() {
  const [refreshNonce, setRefreshNonce] = useState(0)
  const tags = useLiveQuery(() => StorageService.getTags(), [refreshNonce]) ?? []

  const refresh = useCallback(async () => {
    await StorageService.getTags()
    setRefreshNonce((current) => current + 1)
  }, [])

  return { tags, refresh }
}
