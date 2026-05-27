import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

export default function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn('flex flex-row items-center gap-2 sm:gap-3', className)}>{children}</div>
  )
}
