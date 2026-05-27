import { useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getCategories } from '../services/repositories/categoryRepository'
import type { Category } from '../types'

export const useCategories = () => {
  const [refreshNonce, setRefreshNonce] = useState(0)
  const categories = useLiveQuery(() => getCategories(), [refreshNonce]) ?? []

  const refresh = useCallback(async () => {
    await getCategories()
    setRefreshNonce((current) => current + 1)
  }, [])

  return { categories: categories as Category[], refresh }
}
