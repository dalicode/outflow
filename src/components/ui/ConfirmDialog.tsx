import { cn } from '../../lib/cn'
import Modal from './Modal'
import ModalActionRow from './ModalActionRow'

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
        <ModalActionRow
          actions={[
            {
              key: 'cancel',
              label: cancelLabel,
              onClick: handleCancel,
              tone: 'cancel',
            },
            {
              key: 'confirm',
              label: confirmLabel,
              onClick: handleConfirm,
              disabled: confirmDisabled,
              stopPointerDownPropagation: true,
              tone: confirmVariant === 'destructive' ? 'destructive' : 'primary',
              className: cn(confirmDisabled && 'opacity-50'),
            },
          ]}
        />
      }
    >
      {description && <div className="pb-1 text-sm text-theme-muted">{description}</div>}
    </Modal>
  )
}
