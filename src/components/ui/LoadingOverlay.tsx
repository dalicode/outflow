import { createPortal } from 'react-dom'
import { cn } from '../../utils/cn'
import Spinner from './Spinner'

interface LoadingOverlayProps {
  isOpen: boolean
  message?: string
  subMessage?: string
  showSpinner?: boolean
  inline?: boolean
}

export default function LoadingOverlay({
  isOpen,
  message = 'Loading…',
  subMessage,
  showSpinner = true,
  inline = false,
}: LoadingOverlayProps) {
  if (!isOpen) return null

  const overlayContent = (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 backdrop-blur-sm',
        inline
          ? 'absolute inset-0 z-10 bg-theme-background-solid'
          : 'fixed inset-0 z-[60] h-[100dvh] w-[100dvw] bg-theme-background-solid',
      )}
    >
      {showSpinner && <Spinner />}
      <p className="text-theme-text font-medium">{message}</p>
      {subMessage && <p className="text-theme-muted text-sm">{subMessage}</p>}
    </div>
  )

  if (inline) {
    return overlayContent
  }

  return createPortal(overlayContent, document.body)
}
