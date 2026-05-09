import { normalizeName } from '../../utils/normalizeName'
import Modal from './Modal'
import ModalFooter from './ModalFooter'

interface DeleteEntityDialogProps {
  isOpen: boolean
  onClose: () => void
  entityType: 'category' | 'payee'
  entityName: string
  /** Whether there are other active entities to merge into */
  canMerge: boolean
  onConfirmDelete: () => void
  onMergeInstead: () => void
}

export default function DeleteEntityDialog({
  isOpen,
  onClose,
  entityType,
  entityName,
  canMerge,
  onConfirmDelete,
  onMergeInstead,
}: DeleteEntityDialogProps) {
  const label = entityType === 'category' ? 'category' : 'payee'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${label}`}
      size="sm"
      footer={
        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-modal-cancel flex-1">
            Cancel
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              onConfirmDelete()
              onClose()
            }}
            className="btn-modal-destructive flex-1"
          >
            Delete
          </button>
        </ModalFooter>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-theme-muted">
          <span className="font-medium text-theme-text">{normalizeName(entityName)}</span>{' '}
          Historical expenses will keep their original {label} — your past data stays accurate.
        </p>

        {canMerge && (
          <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2.5 space-y-2">
            <p className="text-xs text-theme-muted">
              Consolidate expenses under a different {label}?
            </p>
            <button
              type="button"
              onClick={() => {
                onClose()
                onMergeInstead()
              }}
              className="w-full btn-modal-primary py-2 text-xs"
            >
              Merge into another {label} instead
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
