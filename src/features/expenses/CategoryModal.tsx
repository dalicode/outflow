import { type FormEvent, useRef, useState } from 'react'
import DeleteEntityDialog from '../../components/ui/DeleteEntityDialog'
import EntityMergeDialog from '../../components/ui/EntityMergeDialog'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import { useToasts } from '../../context/toastContext'
import { StorageService } from '../../services/storageService'
import type { Category } from '../../types'
import AddEntityButton from './AddEntityButton'

interface CategoryModalProps {
  categories: Category[]
  onCategoriesChange?: (
    action: 'add' | 'update' | 'delete' | 'merge',
    payload: { id?: number; name?: string },
  ) => Promise<number | undefined>
  onClose: () => void
  refreshCategories?: () => void | Promise<void>
  refreshExpenses?: () => Promise<void>
}

export default function CategoryModal({
  categories,
  onCategoriesChange,
  onClose,
  refreshCategories,
  refreshExpenses,
}: CategoryModalProps) {
  const { showToast, showUndoToast } = useToasts()
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [mergeSource, setMergeSource] = useState<Category | null>(null)
  const [mergeExpenseCount, setMergeExpenseCount] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const newNameInputRef = useRef<HTMLInputElement>(null)

  const active = categories
    .filter((c) => !c.isArchived)
    .sort((a, b) => a.name.localeCompare(b.name))
  const filteredCategories = active.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )

  const addCat = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      showToast({ message: 'Name is required.', tone: 'danger' })
      return
    }
    if (active.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      showToast({ message: 'Already exists.', tone: 'danger' })
      return
    }
    if (onCategoriesChange) {
      await onCategoriesChange('add', { name })
    } else {
      await StorageService.addCategory(name)
      refreshCategories?.()
    }
    showToast({ message: 'Category added', tone: 'success' })
    setNewName('')
  }

  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (editId == null) return
    const name = editName.trim()
    if (!name) return
    if (active.some((c) => c.id !== editId && c.name.toLowerCase() === name.toLowerCase())) return
    if (onCategoriesChange) {
      await onCategoriesChange('update', { id: editId, name })
    } else {
      await StorageService.updateCategory(editId, { name })
      refreshCategories?.()
    }
    setEditId(null)
  }

  const openMerge = async (cat: Category) => {
    if (cat.id == null) return
    const count = await StorageService.getExpenseCountForCategory(cat.id)
    setMergeExpenseCount(count)
    setMergeSource(cat)
  }

  const handleMerge = async (targetId: number) => {
    if (!mergeSource || mergeSource.id == null) return
    const mergeId = await StorageService.mergeCategory(mergeSource.id, targetId)
    await refreshCategories?.()
    await refreshExpenses?.()
    if (onCategoriesChange) {
      await onCategoriesChange('merge', { id: mergeSource.id })
    }
    const targetName = active.find((c) => c.id === targetId)?.name ?? 'another category'
    const sourceName = mergeSource.name
    showUndoToast(`Merged ${sourceName} into ${targetName}`, async () => {
      await StorageService.revertCategoryMerge(mergeId)
      showToast({ message: `Undid merge of ${sourceName} into ${targetName}`, tone: 'success' })
      await refreshCategories?.()
      await refreshExpenses?.()
      if (onCategoriesChange) await onCategoriesChange('merge', { id: mergeSource.id })
    })
    setMergeSource(null)
  }

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Manage Categories"
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
          onSubmit={addCat}
          className="flex shrink-0 flex-col gap-2 rounded-theme-medium border border-theme-border bg-theme-surface p-3 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            <input
              ref={newNameInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category…"
              autoFocus
              className="input-md w-full"
            />
          </div>
          <AddEntityButton label="Add category" />
        </form>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-theme-medium border border-theme-border bg-theme-background">
          <div className="border-b border-theme-border p-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
              className="input-md w-full"
            />
          </div>
          {active.length === 0 ? (
            <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-theme-muted">
              No categories yet.
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-theme-muted">
              No categories match your search.
            </div>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-themed">
              {filteredCategories.map((cat) => (
                <li
                  key={cat.id}
                  className="border-b border-theme-border p-3 last:border-b-0"
                  data-testid={`category-row-${cat.id}`}
                >
                  {editId === cat.id ? (
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
                        {cat.name}
                      </span>
                      <div className="flex gap-3 text-sm sm:gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(cat.id as number)
                            setEditName(cat.name)
                          }}
                          className="font-medium text-theme-primary hover:opacity-80"
                        >
                          Edit
                        </button>
                        {active.length > 1 && (
                          <button
                            type="button"
                            onClick={() => openMerge(cat)}
                            className="font-medium text-theme-muted hover:text-theme-text"
                          >
                            Merge
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
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
          entityType="category"
          sourceName={mergeSource.name}
          targetOptions={active
            .filter((c) => c.id !== mergeSource.id)
            .map((c) => ({ id: c.id as number, name: c.name }))}
          affectedExpenseCount={mergeExpenseCount}
          onConfirm={handleMerge}
        />
      )}

      {deleteTarget && (
        <DeleteEntityDialog
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          entityType="category"
          entityName={deleteTarget.name}
          canMerge={active.length > 1}
          onConfirmDelete={async () => {
            if (onCategoriesChange) {
              await onCategoriesChange('delete', { id: deleteTarget.id })
            } else {
              await StorageService.deleteCategory(deleteTarget.id as number)
              await refreshCategories?.()
            }
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
