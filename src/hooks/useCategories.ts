import { useCallback, useEffect, useState } from 'react'
import { StorageService } from '../services/storageService'
import type { Category } from '../types'

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    StorageService.getCategories().then((data: Category[]) => setCategories(data))
  }, [])

  const refresh = useCallback(async () => {
    setCategories((await StorageService.getCategories()) as Category[])
  }, [])

  return { categories, setCategories, refresh }
}
