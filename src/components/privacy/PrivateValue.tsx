import type { ReactNode } from 'react'
import { useSettings } from '../../context/settingsContext'
import { cn } from '../../utils/cn'

interface PrivateValueProps {
  children: ReactNode
  className?: string
}

export default function PrivateValue({ children, className }: PrivateValueProps) {
  const { privacyModeEnabled } = useSettings()

  return (
    <span
      className={cn(
        'inline-block transition-[filter,opacity] duration-150',
        privacyModeEnabled && 'blur-sm select-none opacity-80',
        className,
      )}
    >
      {children}
    </span>
  )
}
