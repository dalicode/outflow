import { useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { StorageService } from '../services/storageService'
import type { Category } from '../types'

export const useCategories = () => {
  const [refreshNonce, setRefreshNonce] = useState(0)
  const categories = useLiveQuery(() => StorageService.getCategories(), [refreshNonce]) ?? []

  const refresh = useCallback(async () => {
    await StorageService.getCategories()
    setRefreshNonce((current) => current + 1)
  }, [])

  return { categories: categories as Category[], refresh }
}
