import { useCallback, useEffect, useRef, useState } from 'react'

interface UseScrollActivityOptions {
  enabled?: boolean
  timeoutMs?: number
}

interface UseScrollActivityResult {
  isScrolling: boolean
  markScrolling: () => void
}

export function useScrollActivity({
  enabled = true,
  timeoutMs = 800,
}: UseScrollActivityOptions = {}): UseScrollActivityResult {
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const markScrolling = useCallback(() => {
    if (!enabled) return

    setIsScrolling(true)
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, timeoutMs)
  }, [enabled, timeoutMs])

  useEffect(() => {
    if (enabled) return
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    setIsScrolling(false)
  }, [enabled])

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return { isScrolling, markScrolling }
}
