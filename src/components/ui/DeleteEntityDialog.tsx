import Modal from './Modal'
import ModalFooter from './ModalFooter'

interface DeleteEntityDialogProps {
  isOpen: boolean
  onClose: () => void
  entityType: 'category' | 'payee' | 'tag'
  entityName: string
  /** Whether there are other active entities to merge into */
  canMerge: boolean
  onConfirmDelete: () => void
  onMergeInstead: () => void
  primaryDeleteDescription?: string
  secondaryDeleteDescription?: string
  secondaryDestructiveAction?: {
    label: string
    onAction: () => void | Promise<void>
  }
}

export default function DeleteEntityDialog({
  isOpen,
  onClose,
  entityType,
  entityName,
  canMerge,
  onConfirmDelete,
  onMergeInstead,
  primaryDeleteDescription,
  secondaryDeleteDescription,
  secondaryDestructiveAction,
}: DeleteEntityDialogProps) {
  const label = entityType === 'category' ? 'category' : entityType === 'payee' ? 'payee' : 'tag'
  const deleteDescription =
    primaryDeleteDescription ??
    `${entityName} Historical expenses will keep their original ${label} — your past data stays accurate.`

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
            }}
            className="btn-modal-destructive flex-1"
          >
            Delete
          </button>
        </ModalFooter>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-theme-muted">{deleteDescription}</p>

        {canMerge && (
          <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2.5 space-y-2">
            <p className="text-xs text-theme-muted">
              Consolidate expenses under a different {label}?
            </p>
            <button
              type="button"
              onClick={() => {
                onMergeInstead()
              }}
              className="w-full btn-modal-primary py-2 text-xs"
            >
              Merge into another {label}
            </button>
          </div>
        )}

        {secondaryDestructiveAction && (
          <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2.5 space-y-2">
            {secondaryDeleteDescription && (
              <p className="text-xs text-theme-muted">{secondaryDeleteDescription}</p>
            )}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={secondaryDestructiveAction.onAction}
              className="w-full btn-modal-destructive py-2 text-xs"
            >
              {secondaryDestructiveAction.label}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
