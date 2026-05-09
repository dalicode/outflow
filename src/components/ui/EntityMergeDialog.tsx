import { useState } from 'react'
import { cn } from '../../utils/cn'
import { normalizeName } from '../../utils/normalizeName'
import Modal from './Modal'
import ModalFooter from './ModalFooter'

interface MergeTarget {
  id: number
  name: string
}

interface EntityMergeDialogProps {
  isOpen: boolean
  onClose: () => void
  entityType: 'category' | 'payee'
  sourceName: string
  targetOptions: MergeTarget[]
  affectedExpenseCount: number
  onConfirm: (targetId: number) => Promise<void>
}

export default function EntityMergeDialog({
  isOpen,
  onClose,
  entityType,
  sourceName,
  targetOptions,
  affectedExpenseCount,
  onConfirm,
}: EntityMergeDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<number | ''>('')
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = entityType === 'category' ? 'category' : 'payee'
  const Label = entityType === 'category' ? 'Category' : 'Payee'

  const handleClose = () => {
    setSelectedTargetId('')
    setError(null)
    onClose()
  }

  const handleConfirm = async () => {
    if (!selectedTargetId) return
    setMerging(true)
    setError(null)
    try {
      await onConfirm(selectedTargetId as number)
      handleClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setMerging(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Merge ${Label}`}
      size="sm"
      footer={
        <ModalFooter>
          <button
            type="button"
            onClick={handleClose}
            className="btn-modal-cancel flex-1"
            disabled={merging}
          >
            Cancel
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleConfirm}
            disabled={!selectedTargetId || merging}
            className={cn(
              'flex-1 btn-modal-primary',
              (!selectedTargetId || merging) && 'opacity-50 cursor-not-allowed',
            )}
          >
            {merging ? 'Merging…' : `Merge ${Label}`}
          </button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        {/* Description */}
        <p className="text-sm text-theme-muted">
          You're about to merge{' '}
          <span className="font-medium text-theme-text">{normalizeName(sourceName)}</span> into
          another {label}.{' '}
          {affectedExpenseCount > 0 ? (
            <>
              <span className="font-medium text-theme-text">{affectedExpenseCount}</span>{' '}
              {affectedExpenseCount === 1 ? 'expense' : 'expenses'} will be moved to the selected{' '}
              {label}.{' '}
            </>
          ) : (
            <>No expenses will be affected. </>
          )}
          The original {label} will be archived and hidden from new expenses.
        </p>

        {/* Target selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-theme-muted uppercase tracking-wider">
            Merge into
          </label>
          <select
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value ? Number(e.target.value) : '')}
            className="input-md w-full cursor-pointer"
          >
            <option value="">Select {label}…</option>
            {targetOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {normalizeName(t.name)}
              </option>
            ))}
          </select>
        </div>

        {/* Warning */}
        <div className="rounded-theme-medium border border-[color:color-mix(in_srgb,var(--theme-danger)_25%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-danger)_5%,var(--theme-surface))] px-3 py-2.5">
          <p className="text-xs text-theme-danger">
            <span className="font-semibold">Warning:</span> This updates historical expenses. Use
            Delete instead if you want old reports to keep the original {label}.
          </p>
        </div>

        {error && <p className="text-xs text-theme-danger">{error}</p>}
      </div>
    </Modal>
  )
}
