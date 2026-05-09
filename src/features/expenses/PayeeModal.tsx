import { type FormEvent, useState } from 'react'
import DeleteEntityDialog from '../../components/ui/DeleteEntityDialog'
import EntityMergeDialog from '../../components/ui/EntityMergeDialog'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import { useToasts } from '../../context/toastContext'
import { StorageService } from '../../services/storageService'
import type { Payee } from '../../types'
import AddEntityButton from './AddEntityButton'

interface PayeeModalProps {
  payees: Payee[]
  onPayeesChange?: () => void
  onClose: () => void
  refreshPayees?: () => void | Promise<void>
}

export default function PayeeModal({
  payees,
  onPayeesChange,
  onClose,
  refreshPayees,
}: PayeeModalProps) {
  const { showUndoToast } = useToasts()
  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [mergeSource, setMergeSource] = useState<Payee | null>(null)
  const [mergeExpenseCount, setMergeExpenseCount] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<Payee | null>(null)

  const active = payees.filter((p) => !p.isArchived)
  const filteredPayees = active.filter((payee) =>
    payee.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )

  const addPayee = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      setNewError('Name is required.')
      return
    }
    if (active.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setNewError('Already exists.')
      return
    }
    try {
      await StorageService.addPayee(name)
      setNewName('')
      setNewError('')
      onPayeesChange?.()
      refreshPayees?.()
    } catch (err) {
      setNewError((err as Error).message)
    }
  }

  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (editId == null) return
    const name = editName.trim()
    if (!name) return
    if (active.some((p) => p.id !== editId && p.name.toLowerCase() === name.toLowerCase())) return
    try {
      await StorageService.updatePayee(editId, name)
      setEditId(null)
      onPayeesChange?.()
      refreshPayees?.()
    } catch (err) {
      setNewError((err as Error).message)
    }
  }

  const handleArchive = async (id: number) => {
    await StorageService.archivePayee(id)
    onPayeesChange?.()
    refreshPayees?.()
    showUndoToast('Payee archived.', async () => {
      await StorageService.unarchivePayee(id)
      onPayeesChange?.()
      refreshPayees?.()
    })
  }

  const openMerge = async (payee: Payee) => {
    if (payee.id == null) return
    const count = await StorageService.getExpenseCountForPayee(payee.id)
    setMergeExpenseCount(count)
    setMergeSource(payee)
  }

  const handleMerge = async (targetId: number) => {
    if (!mergeSource || mergeSource.id == null) return
    await StorageService.mergePayee(mergeSource.id, targetId)
    onPayeesChange?.()
    await refreshPayees?.()
    setMergeSource(null)
  }

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Manage Payees"
        size="lg"
        mobileFullScreen
        bodyClassName="flex flex-col gap-4 overflow-hidden"
        footer={
          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              className="btn-modal-primary min-h-12 flex-1 text-base sm:min-h-0 sm:text-[0.8125rem]"
            >
              Done
            </button>
          </ModalFooter>
        }
      >
        <form
          onSubmit={addPayee}
          className="flex shrink-0 flex-col gap-2 rounded-theme-medium border border-theme-border bg-theme-surface p-3 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            <input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                setNewError('')
              }}
              placeholder="New payee…"
              autoFocus
              className="input-md w-full"
            />
            {newError && <p className="mt-1.5 text-xs text-theme-danger">{newError}</p>}
          </div>
          <AddEntityButton label="Add payee" />
        </form>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-theme-medium border border-theme-border bg-theme-background">
          <div className="border-b border-theme-border p-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payees..."
              className="input-md w-full"
            />
          </div>
          {active.length === 0 ? (
            <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-theme-muted">
              No payees yet.
            </div>
          ) : filteredPayees.length === 0 ? (
            <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-theme-muted">
              No payees match your search.
            </div>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-themed">
              {filteredPayees.map((payee) => (
                <li key={payee.id} className="border-b border-theme-border p-3 last:border-b-0">
                  {editId === payee.id ? (
                    <form
                      onSubmit={saveEdit}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center"
                    >
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input-md min-w-0 flex-1"
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="btn-primary-sm flex-1 sm:flex-none">
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditId(null)}
                          className="btn-cancel-sm flex-1 sm:flex-none"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-theme-text">
                        {payee.name}
                      </span>
                      <div className="flex gap-3 text-sm sm:gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(payee.id as number)
                            setEditName(payee.name)
                          }}
                          className="font-medium text-theme-primary hover:opacity-80"
                        >
                          Edit
                        </button>
                        {active.length > 1 && (
                          <button
                            type="button"
                            onClick={() => openMerge(payee)}
                            className="font-medium text-theme-muted hover:text-theme-text"
                          >
                            Merge
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(payee)}
                          className="font-medium text-theme-danger hover:opacity-80"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      {mergeSource && (
        <EntityMergeDialog
          isOpen={true}
          onClose={() => setMergeSource(null)}
          entityType="payee"
          sourceName={mergeSource.name}
          targetOptions={active
            .filter((p) => p.id !== mergeSource.id)
            .map((p) => ({ id: p.id as number, name: p.name }))}
          affectedExpenseCount={mergeExpenseCount}
          onConfirm={handleMerge}
        />
      )}

      {deleteTarget && (
        <DeleteEntityDialog
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          entityType="payee"
          entityName={deleteTarget.name}
          canMerge={active.length > 1}
          onConfirmDelete={async () => {
            await handleArchive(deleteTarget.id as number)
            setDeleteTarget(null)
          }}
          onMergeInstead={() => {
            openMerge(deleteTarget)
            setDeleteTarget(null)
          }}
        />
      )}
    </>
  )
}
