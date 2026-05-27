import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'
import { getTags } from '../services/repositories/tagRepository'

export function useTags() {
  const [refreshNonce, setRefreshNonce] = useState(0)
  const tags = useLiveQuery(() => getTags(), [refreshNonce]) ?? []

  const refresh = useCallback(async () => {
    await getTags()
    setRefreshNonce((current) => current + 1)
  }, [])

  return { tags, refresh }
}
