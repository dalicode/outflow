import Modal from './Modal'
import LoadingOverlay from './LoadingOverlay'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface LazyModalFallbackProps {
  title: string
  message?: string
  size?: ModalSize
  onClose: () => void
}

export default function LazyModalFallback({
  title,
  message = 'Loading…',
  size = 'md',
  onClose,
}: LazyModalFallbackProps) {
  return (
    <Modal isOpen={true} onClose={onClose} title={title} size={size}>
      <div className="relative min-h-32">
        <LoadingOverlay isOpen={true} inline message={message} />
      </div>
    </Modal>
  )
}
