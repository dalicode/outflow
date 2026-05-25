import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback } from 'react'
import { StorageService } from '../services/storageService'

export function useTags() {
  const tags = useLiveQuery(() => StorageService.getTags(), []) ?? []

  const refresh = useCallback(async () => {
    await StorageService.getTags()
  }, [])

  return { tags, refresh }
}
