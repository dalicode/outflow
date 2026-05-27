import { useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getPayees } from '../services/repositories/payeeRepository'
import type { Payee } from '../types'

export const usePayees = () => {
  const [refreshNonce, setRefreshNonce] = useState(0)
  const payees = useLiveQuery(() => getPayees(), [refreshNonce]) ?? []

  const refresh = useCallback(async () => {
    await getPayees()
    setRefreshNonce((current) => current + 1)
  }, [])

  return { payees: payees as Payee[], refresh }
}
