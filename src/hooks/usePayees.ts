import { useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { StorageService } from '../services/storageService'
import type { Payee } from '../types'

export const usePayees = () => {
  const [refreshNonce, setRefreshNonce] = useState(0)
  const payees = useLiveQuery(() => StorageService.getPayees(), [refreshNonce]) ?? []

  const refresh = useCallback(async () => {
    await StorageService.getPayees()
    setRefreshNonce((current) => current + 1)
  }, [])

  return { payees: payees as Payee[], refresh }
}
