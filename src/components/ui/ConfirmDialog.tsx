import { cn } from '../../utils/cn'
import Modal from './Modal'
import ModalFooter from './ModalFooter'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  cancelLabel?: string
  confirmLabel?: string
  confirmVariant?: 'default' | 'destructive'
  onCancel?: () => void
  onConfirm: () => void
  confirmDisabled?: boolean
  size?: 'sm' | 'md'
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  onCancel,
  onConfirm,
  confirmDisabled = false,
  size = 'sm',
}: ConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.()
    onClose()
  }

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <ModalFooter>
          <button type="button" onClick={handleCancel} className="btn-cancel-sm flex-1">
            {cancelLabel}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className={cn(
              'flex-1',
              confirmVariant === 'destructive' ? 'btn-modal-destructive' : 'btn-modal-primary',
            )}
          >
            {confirmLabel}
          </button>
        </ModalFooter>
      }
    >
      {description && <div className="pb-1">{description}</div>}
    </Modal>
  )
}
