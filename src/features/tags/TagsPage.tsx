import { useEffect, useMemo, useState } from 'react'
import DeleteEntityDialog from '../../components/ui/DeleteEntityDialog'
import EmptyState from '../../components/ui/EmptyState'
import EntityMergeDialog from '../../components/ui/EntityMergeDialog'
import { useToasts } from '../../context/toastContext'
import { useTags } from '../../hooks/useLocalData'
import { StorageService } from '../../services/storageService'
import type { Tag } from '../../types'
import { getTagSummaryChipStyle } from '../../utils/tagChip'

interface TagsPageProps {
  refreshExpenses?: () => Promise<void>
  triggerSync?: () => void
}

export default function TagsPage({ refreshExpenses, triggerSync }: TagsPageProps) {
  const { tags, refresh } = useTags()
  const { showToast, showUndoToast } = useToasts()
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [mergeSource, setMergeSource] = useState<Tag | null>(null)
  const [mergeExpenseCount, setMergeExpenseCount] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)
  const [usageCounts, setUsageCounts] = useState<Record<number, number>>({})

  const activeTags = useMemo(() => tags.filter((tag) => !tag.isArchived), [tags])
  const sortedTags = useMemo(
    () => [...activeTags].sort((a, b) => a.name.localeCompare(b.name)),
    [activeTags],
  )

  const filteredTags = useMemo(() => {
    if (!search.trim()) return sortedTags
    const q = search.toLowerCase()
    return sortedTags.filter((tag) => tag.name.toLowerCase().includes(q))
  }, [search, sortedTags])

  useEffect(() => {
    let cancelled = false

    async function loadUsageCounts() {
      const activeTagIds = activeTags
        .filter((tag): tag is Tag & { id: number } => typeof tag.id === 'number')
        .map((tag) => tag.id)
      const counts = await StorageService.getExpenseCountsForTags(activeTagIds)
      if (cancelled) return
      setUsageCounts(counts)
    }

    void loadUsageCounts()

    return () => {
      cancelled = true
    }
  }, [activeTags])

  const handleAdd = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    try {
      await StorageService.addTag(trimmed)
      setNewName('')
      await refresh()
      triggerSync?.()
      showToast({ message: 'Tag added', tone: 'success' })
    } catch (error) {
      showToast({ message: (error as Error).message, tone: 'danger' })
    }
  }

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id as number)
    setEditName(tag.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const saveEdit = async (id: number) => {
    const trimmed = editName.trim()
    if (!trimmed) return
    try {
      await StorageService.updateTag(id, { name: trimmed })
      setEditingId(null)
      setEditName('')
      await refresh()
      triggerSync?.()
    } catch (error) {
      showToast({ message: (error as Error).message, tone: 'danger' })
    }
  }

  const handleArchive = async (id: number) => {
    await StorageService.archiveTag(id)
    await refresh()
    await refreshExpenses?.()
    triggerSync?.()
    showUndoToast('Tag archived.', async () => {
      await StorageService.unarchiveTag(id)
      await refresh()
      await refreshExpenses?.()
      triggerSync?.()
    })
  }

  const handleUnlinkAllAndArchive = async (id: number) => {
    const undoPayload = await StorageService.unlinkAllAndArchiveTag(id)
    await refresh()
    await refreshExpenses?.()
    triggerSync?.()
    showUndoToast('Tag unlinked from all expenses and archived.', async () => {
      await StorageService.undoUnlinkAllAndArchiveTag(undoPayload)
      await refresh()
      await refreshExpenses?.()
      triggerSync?.()
    })
  }

  const openMerge = async (tag: Tag) => {
    if (tag.id == null) return
    const count = await StorageService.getExpenseCountForTag(tag.id)
    setMergeExpenseCount(count)
    setMergeSource(tag)
  }

  const handleMerge = async (targetId: number) => {
    if (!mergeSource?.id) return
    const mergeId = await StorageService.mergeTag(mergeSource.id, targetId)
    const targetName = activeTags.find((tag) => tag.id === targetId)?.name ?? 'another tag'
    const sourceName = mergeSource.name
    await refresh()
    await refreshExpenses?.()
    triggerSync?.()
    setMergeSource(null)
    showUndoToast(`Merged ${sourceName} into ${targetName}`, async () => {
      await StorageService.revertTagMerge(mergeId)
      await refresh()
      await refreshExpenses?.()
      triggerSync?.()
      showToast({ message: `Undid merge of ${sourceName} into ${targetName}`, tone: 'success' })
    })
  }

  return (
    <>
      <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6" data-testid="tags-page">
        <h1 className="text-xl font-bold text-theme-text">Tags</h1>

        <div className="flex flex-col md:max-w-3xl mx-auto sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tags..."
            className="input-md flex-1"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="New tag name"
              className="input-md flex-1 sm:w-48"
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleAdd()
              }}
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={!newName.trim()}
              data-testid="btn-add-tag"
              className="bg-theme-primary hover:opacity-90 disabled:opacity-40 text-white text-xs font-medium px-4 py-2 rounded-theme-small transition-opacity whitespace-nowrap"
            >
              Add
            </button>
          </div>
        </div>

        <div className="md:max-w-3xl mx-auto">
          {filteredTags.map((tag) => (
            <div
              key={tag.id}
              data-testid={`tag-row-${tag.id}`}
              className="flex items-center justify-between py-2 px-3 rounded-theme-small border-b border-theme-border hover:bg-theme-surface transition-colors"
            >
              {editingId === tag.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    className="input-sm flex-1"
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void saveEdit(tag.id as number)
                      if (event.key === 'Escape') cancelEdit()
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void saveEdit(tag.id as number)}
                    className="text-xs text-theme-primary font-medium"
                  >
                    Save
                  </button>
                  <button type="button" onClick={cancelEdit} className="text-xs text-theme-muted">
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-flex max-w-full items-center rounded-theme-small border px-2 py-0.5 text-xs font-medium truncate"
                        style={getTagSummaryChipStyle(tag)}
                      >
                        {tag.name}
                      </span>
                    </div>
                    <p className="text-xs text-theme-muted">
                      {(tag.id != null ? usageCounts[tag.id] : 0) ?? 0}{' '}
                      {(tag.id != null ? usageCounts[tag.id] : 0) === 1 ? 'expense' : 'expenses'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(tag)}
                      data-testid={`btn-edit-tag-${tag.id}`}
                      className="text-xs text-theme-primary hover:opacity-80 font-medium"
                    >
                      Edit
                    </button>
                    {activeTags.length > 1 && (
                      <button
                        type="button"
                        onClick={() => void openMerge(tag)}
                        className="text-xs text-theme-muted hover:text-theme-text font-medium"
                      >
                        Merge
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(tag)}
                      data-testid={`btn-delete-tag-${tag.id}`}
                      className="text-xs text-theme-danger hover:opacity-80"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {filteredTags.length === 0 && (
            <EmptyState message={search.trim() ? 'No tags match your search.' : 'No tags yet.'} />
          )}
        </div>
      </div>

      {mergeSource && (
        <EntityMergeDialog
          isOpen={true}
          onClose={() => setMergeSource(null)}
          entityType="tag"
          sourceName={mergeSource.name}
          targetOptions={activeTags
            .filter((tag) => tag.id !== mergeSource.id)
            .map((tag) => ({ id: tag.id as number, name: tag.name }))}
          affectedExpenseCount={mergeExpenseCount}
          onConfirm={handleMerge}
        />
      )}

      {deleteTarget && (
        <DeleteEntityDialog
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          entityType="tag"
          entityName={deleteTarget.name}
          canMerge={activeTags.length > 1}
          primaryDeleteDescription={`Delete: archive "${deleteTarget.name}" and keep existing expense-tag links.`}
          secondaryDeleteDescription={`Unlink all and delete: remove "${deleteTarget.name}" from all linked expenses and archive it.`}
          secondaryDestructiveAction={{
            label: 'Unlink all and delete',
            onAction: async () => {
              await handleUnlinkAllAndArchive(deleteTarget.id as number)
              setDeleteTarget(null)
            },
          }}
          onConfirmDelete={async () => {
            await handleArchive(deleteTarget.id as number)
            setDeleteTarget(null)
          }}
          onMergeInstead={() => {
            void openMerge(deleteTarget)
            setDeleteTarget(null)
          }}
        />
      )}
    </>
  )
}
