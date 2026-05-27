import type { ReactNode } from 'react'
import { useSettings } from '../../context/settingsContext'
import { cn } from '../../lib/cn'

interface PrivateValueProps {
  children: ReactNode
  className?: string
}

const MONEY_MASK = '$888,888.88'
const PERCENTAGE_MASK = '888.88%'
const GENERIC_MASK = '888888.88'

function nodeToText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) {
    return node.map((item) => nodeToText(item)).join('')
  }
  return ''
}

function resolveMask(valueText: string): string {
  if (!valueText) return GENERIC_MASK
  if (/%/.test(valueText)) return PERCENTAGE_MASK
  if (/[$€£¥₹]/.test(valueText)) return MONEY_MASK
  return GENERIC_MASK
}

export default function PrivateValue({ children, className }: PrivateValueProps) {
  const { privacyModeEnabled, loaded } = useSettings()
  const maskedValue = resolveMask(nodeToText(children))
  const shouldHideValue = privacyModeEnabled || !loaded

  return (
    <span
      className={cn(
        'inline-block transition-opacity duration-150',
        shouldHideValue && 'blur-[0.26em] select-none opacity-80',
        className,
      )}
    >
      {shouldHideValue ? maskedValue : children}
    </span>
  )
}
