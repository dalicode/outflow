import { useCallback, useEffect, useState } from 'react'

export function usePersistedToggle(
  storageKey: string,
  defaultValue: boolean,
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) return stored === 'true'
    } catch {
      // localStorage unavailable
    }
    return defaultValue
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(value))
    } catch {
      // localStorage unavailable
    }
  }, [storageKey, value])

  const set = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setValue((prev) => (typeof next === 'function' ? next(prev) : next))
  }, [])

  return [value, set]
}
