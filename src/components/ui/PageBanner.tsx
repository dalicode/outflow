import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/cn'

interface PageBannerProps {
  message: string
  type: 'success' | 'error'
}

export default function PageBanner({ message, type }: PageBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 2500)
    return () => clearTimeout(timer)
  }, [message])

  if (!message || !visible) return null

  return createPortal(
    <div
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-sm w-full px-4',
        'animate-slide-down',
      )}
    >
      <div
        className={cn(
          'rounded-theme-medium border px-5 py-3 text-sm font-medium text-center shadow-lg bg-theme-surface',
          type === 'success'
            ? 'border-theme-success text-theme-success'
            : 'border-theme-danger text-theme-danger',
        )}
      >
        {message}
      </div>
    </div>,
    document.body,
  )
}
