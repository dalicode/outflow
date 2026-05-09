import { useCallback, useEffect, useState } from 'react'
import { StorageService } from '../services/storageService'
import type { Payee } from '../types'

export const usePayees = () => {
  const [payees, setPayees] = useState<Payee[]>([])

  useEffect(() => {
    StorageService.getPayees().then((data: Payee[]) => setPayees(data))
  }, [])

  const refresh = useCallback(async () => {
    setPayees((await StorageService.getPayees()) as Payee[])
  }, [])

  return { payees, setPayees, refresh }
}
