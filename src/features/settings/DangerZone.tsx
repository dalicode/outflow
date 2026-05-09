import { useState } from 'react'
import Card from '../../components/ui/Card'
import LoadingOverlay from '../../components/ui/LoadingOverlay'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'

interface DangerZoneProps {
  onClearAll: () => Promise<void>
  variant?: 'default' | 'flat'
}

export default function DangerZone({ onClearAll, variant = 'default' }: DangerZoneProps) {
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [isReloading, setIsReloading] = useState(false)

  const handleClose = () => {
    setIsClearModalOpen(false)
    setDeleteConfirm('')
  }

  const triggerReload = () => {
    setIsReloading(true)
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  return (
    <>
      <Card title="Danger Zone" className="border-theme-danger-subtle" variant={variant}>
        <p className="text-xs text-theme-muted mb-2">
          Permanently delete all expenses, categories, fixed expenses, snapshots, and settings. This
          cannot be undone.
        </p>
        <button
          onClick={() => setIsClearModalOpen(true)}
          data-testid="btn-clear-data"
          className="settings-danger-btn"
        >
          Clear All Data
        </button>
      </Card>

      <Modal
        isOpen={isClearModalOpen}
        onClose={handleClose}
        title="Clear All Data"
        size="sm"
        footer={
          <ModalFooter>
            <button onClick={handleClose} className="btn-cancel-sm flex-1">
              Cancel
            </button>
            <button
              onClick={async () => {
                if (deleteConfirm !== 'DELETE') return
                await onClearAll()
                handleClose()
                triggerReload()
              }}
              disabled={deleteConfirm !== 'DELETE'}
              className="btn-modal-destructive flex-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear Everything
            </button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-theme-muted">
            This will permanently delete <strong className="text-theme-text">everything</strong> —
            expenses, categories, fixed expenses, snapshots, and settings. This action cannot be
            undone.
          </p>
          <label className="flex flex-col gap-1 text-xs text-theme-muted">
            Type <span className="font-mono text-theme-danger">DELETE</span> to confirm
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="input-theme px-3 py-2 text-sm"
              autoFocus
            />
          </label>
        </div>
      </Modal>

      <LoadingOverlay isOpen={isReloading} message="Deleting…" subMessage="Refreshing app…" />
    </>
  )
}
