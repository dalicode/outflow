import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TagsPage from '../features/tags/TagsPage'

const {
  addTag,
  updateTag,
  archiveTag,
  unarchiveTag,
  unlinkAllAndArchiveTag,
  undoUnlinkAllAndArchiveTag,
  getExpenseCountsForTags,
  getExpenseCountForTag,
  mergeTag,
  revertTagMerge,
  showToast,
  showUndoToast,
  useTagsState,
} = vi.hoisted(() => ({
  addTag: vi.fn(),
  updateTag: vi.fn(),
  archiveTag: vi.fn(),
  unarchiveTag: vi.fn(),
  unlinkAllAndArchiveTag: vi.fn(),
  undoUnlinkAllAndArchiveTag: vi.fn(),
  getExpenseCountsForTags: vi.fn(),
  getExpenseCountForTag: vi.fn(),
  mergeTag: vi.fn(),
  revertTagMerge: vi.fn(),
  showToast: vi.fn(),
  showUndoToast: vi.fn(),
  useTagsState: {
    tags: [
      { id: 1, name: 'Alpha', normalizedName: 'alpha', isArchived: false },
      { id: 2, name: 'Beta', normalizedName: 'beta', isArchived: false },
    ],
    refresh: vi.fn(async () => undefined),
  },
}))

vi.mock('../services/storageService', () => ({
  StorageService: {
    addTag,
    updateTag,
    archiveTag,
    unarchiveTag,
    unlinkAllAndArchiveTag,
    undoUnlinkAllAndArchiveTag,
    getExpenseCountsForTags,
    getExpenseCountForTag,
    mergeTag,
    revertTagMerge,
  },
}))

vi.mock('../hooks/useLocalData', () => ({
  useTags: () => useTagsState,
}))

vi.mock('../context/toastContext', () => ({
  useToasts: () => ({
    showToast,
    showUndoToast,
    dismissToast: vi.fn(),
  }),
}))

vi.mock('../components/ui/Modal', () => ({
  default: ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
}))

vi.mock('../components/ui/DeleteEntityDialog', () => ({
  default: ({
    isOpen,
    onConfirmDelete,
    secondaryDestructiveAction,
  }: {
    isOpen: boolean
    onConfirmDelete: () => void
    secondaryDestructiveAction?: { onAction: () => void }
  }) =>
    isOpen ? (
      <>
        <button type="button" onClick={onConfirmDelete} data-testid="confirm-delete-tag">
          Confirm delete tag
        </button>
        {secondaryDestructiveAction && (
          <button
            type="button"
            onClick={secondaryDestructiveAction.onAction}
            data-testid="confirm-unlink-delete-tag"
          >
            Confirm unlink and delete tag
          </button>
        )}
      </>
    ) : null,
}))

vi.mock('../components/ui/EntityMergeDialog', () => ({
  default: ({
    isOpen,
    targetOptions,
    onConfirm,
  }: {
    isOpen: boolean
    targetOptions: Array<{ id: number; name: string }>
    onConfirm: (targetId: number) => Promise<void>
  }) =>
    isOpen ? (
      <button
        type="button"
        onClick={() => void onConfirm(targetOptions[0].id)}
        data-testid="confirm-merge-tag"
      >
        Confirm merge tag
      </button>
    ) : null,
}))

describe('TagsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTagsState.tags = [
      { id: 1, name: 'Alpha', normalizedName: 'alpha', isArchived: false },
      { id: 2, name: 'Beta', normalizedName: 'beta', isArchived: false },
    ]
    useTagsState.refresh.mockReset()
    useTagsState.refresh.mockResolvedValue(undefined)
    addTag.mockResolvedValue(10)
    updateTag.mockResolvedValue(undefined)
    archiveTag.mockResolvedValue(undefined)
    unarchiveTag.mockResolvedValue(undefined)
    unlinkAllAndArchiveTag.mockResolvedValue({ tagId: 1, unlinkedExpenseTagIds: [100, 101] })
    undoUnlinkAllAndArchiveTag.mockResolvedValue(undefined)
    getExpenseCountsForTags.mockResolvedValue({ 1: 3, 2: 1 })
    getExpenseCountForTag.mockImplementation(async (id: number) => (id === 1 ? 3 : 1))
    mergeTag.mockResolvedValue(500)
    revertTagMerge.mockResolvedValue(undefined)
    showUndoToast.mockReturnValue('toast-id')
  })

  it('adds, filters, and edits tags', async () => {
    render(<TagsPage />)

    await waitFor(() => {
      expect(getExpenseCountsForTags).toHaveBeenCalledWith([1, 2])
    })

    fireEvent.change(screen.getByPlaceholderText('New tag name'), {
      target: { value: 'New Tag' },
    })
    fireEvent.click(screen.getByTestId('btn-add-tag'))

    await waitFor(() => {
      expect(addTag).toHaveBeenCalledWith('New Tag')
      expect(useTagsState.refresh).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByPlaceholderText('Search tags...'), {
      target: { value: 'bet' },
    })
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search tags...'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByTestId('btn-edit-tag-1'))
    const editRow = screen.getByTestId('tag-row-1')
    fireEvent.change(within(editRow).getByRole('textbox'), {
      target: { value: 'Alpha Updated' },
    })
    fireEvent.click(within(editRow).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateTag).toHaveBeenCalledWith(1, { name: 'Alpha Updated' })
      expect(useTagsState.refresh).toHaveBeenCalledTimes(2)
    })
  })

  it('archives with undo and refresh callbacks', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const triggerSync = vi.fn()
    render(<TagsPage refreshExpenses={refreshExpenses} triggerSync={triggerSync} />)

    fireEvent.click(screen.getByTestId('btn-delete-tag-1'))
    fireEvent.click(screen.getByTestId('confirm-delete-tag'))

    await waitFor(() => {
      expect(archiveTag).toHaveBeenCalledWith(1)
      expect(useTagsState.refresh).toHaveBeenCalledTimes(1)
      expect(refreshExpenses).toHaveBeenCalledTimes(1)
      expect(triggerSync).toHaveBeenCalledTimes(1)
      expect(showUndoToast).toHaveBeenCalledWith('Tag archived.', expect.any(Function))
    })

    const undoHandler = showUndoToast.mock.calls[0]?.[1] as () => Promise<void>
    await undoHandler()

    await waitFor(() => {
      expect(unarchiveTag).toHaveBeenCalledWith(1)
      expect(useTagsState.refresh).toHaveBeenCalledTimes(2)
      expect(refreshExpenses).toHaveBeenCalledTimes(2)
      expect(triggerSync).toHaveBeenCalledTimes(2)
    })
  })

  it('merges with undo flow and sync callbacks', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const triggerSync = vi.fn()
    render(<TagsPage refreshExpenses={refreshExpenses} triggerSync={triggerSync} />)

    const alphaRow = screen.getByTestId('tag-row-1')
    fireEvent.click(within(alphaRow).getByRole('button', { name: 'Merge' }))
    await waitFor(() => {
      expect(getExpenseCountForTag).toHaveBeenCalledWith(1)
    })

    fireEvent.click(screen.getByTestId('confirm-merge-tag'))

    await waitFor(() => {
      expect(mergeTag).toHaveBeenCalledWith(1, 2)
      expect(useTagsState.refresh).toHaveBeenCalledTimes(1)
      expect(refreshExpenses).toHaveBeenCalledTimes(1)
      expect(triggerSync).toHaveBeenCalledTimes(1)
      expect(showUndoToast).toHaveBeenCalledWith('Merged Alpha into Beta', expect.any(Function))
    })

    const undoHandler = showUndoToast.mock.calls[0]?.[1] as () => Promise<void>
    await undoHandler()

    await waitFor(() => {
      expect(revertTagMerge).toHaveBeenCalledWith(500)
      expect(useTagsState.refresh).toHaveBeenCalledTimes(2)
      expect(refreshExpenses).toHaveBeenCalledTimes(2)
      expect(triggerSync).toHaveBeenCalledTimes(2)
    })
  })

  it('unlinks all joins and archives with undo flow and sync callbacks', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const triggerSync = vi.fn()
    render(<TagsPage refreshExpenses={refreshExpenses} triggerSync={triggerSync} />)

    fireEvent.click(screen.getByTestId('btn-delete-tag-1'))
    fireEvent.click(screen.getByTestId('confirm-unlink-delete-tag'))

    await waitFor(() => {
      expect(unlinkAllAndArchiveTag).toHaveBeenCalledWith(1)
      expect(useTagsState.refresh).toHaveBeenCalledTimes(1)
      expect(refreshExpenses).toHaveBeenCalledTimes(1)
      expect(triggerSync).toHaveBeenCalledTimes(1)
      expect(showUndoToast).toHaveBeenCalledWith(
        'Tag unlinked from all expenses and archived.',
        expect.any(Function),
      )
    })

    const undoHandler = showUndoToast.mock.calls[0]?.[1] as () => Promise<void>
    await undoHandler()

    await waitFor(() => {
      expect(undoUnlinkAllAndArchiveTag).toHaveBeenCalledWith({
        tagId: 1,
        unlinkedExpenseTagIds: [100, 101],
      })
      expect(useTagsState.refresh).toHaveBeenCalledTimes(2)
      expect(refreshExpenses).toHaveBeenCalledTimes(2)
      expect(triggerSync).toHaveBeenCalledTimes(2)
    })
  })
})
