import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CategoryModal from '../features/expenses/CategoryModal'

const {
  getCategories,
  deleteCategory,
  unarchiveCategory,
  showToast,
  showUndoToast,
  getExpenseCountForCategory,
  mergeCategory,
  revertCategoryMerge,
} = vi.hoisted(() => ({
  getCategories: vi.fn(),
  deleteCategory: vi.fn(),
  unarchiveCategory: vi.fn(),
  showToast: vi.fn(),
  showUndoToast: vi.fn(),
  getExpenseCountForCategory: vi.fn(),
  mergeCategory: vi.fn(),
  revertCategoryMerge: vi.fn(),
}))

vi.mock('../services/storageService', () => ({
  StorageService: {
    getCategories,
    deleteCategory,
    unarchiveCategory,
    getExpenseCountForCategory,
    mergeCategory,
    revertCategoryMerge,
  },
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

vi.mock('../components/ui/ModalFooter', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/ui/EntityMergeDialog', () => ({
  default: () => null,
}))

vi.mock('../components/ui/DeleteEntityDialog', () => ({
  default: ({ isOpen, onConfirmDelete }: { isOpen: boolean; onConfirmDelete: () => void }) =>
    isOpen ? (
      <button type="button" onClick={onConfirmDelete} data-testid="confirm-delete-entity">
        Confirm delete entity
      </button>
    ) : null,
}))

describe('CategoryModal delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCategories.mockResolvedValue([
      { id: 1, name: 'Food', isArchived: false },
      { id: 2, name: 'Travel', isArchived: false },
    ])
    deleteCategory.mockResolvedValue(undefined)
    unarchiveCategory.mockResolvedValue(undefined)
    getExpenseCountForCategory.mockResolvedValue(0)
    mergeCategory.mockResolvedValue(1)
    revertCategoryMerge.mockResolvedValue(undefined)
    showUndoToast.mockReturnValue('toast-id')
  })

  it('archives and supports undo in local fallback mode', async () => {
    const refreshCategories = vi.fn().mockResolvedValue(undefined)
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)

    render(
      <CategoryModal
        categories={[
          { id: 1, name: 'Food', isArchived: false },
          { id: 2, name: 'Travel', isArchived: false },
        ]}
        refreshCategories={refreshCategories}
        refreshExpenses={refreshExpenses}
        onClose={vi.fn()}
      />,
    )

    const categoryRow = screen.getByTestId('category-row-1')
    fireEvent.click(within(categoryRow).getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByTestId('confirm-delete-entity'))

    await waitFor(() => {
      expect(deleteCategory).toHaveBeenCalledWith(1)
      expect(refreshCategories).toHaveBeenCalledTimes(1)
      expect(refreshExpenses).toHaveBeenCalledTimes(1)
      expect(showUndoToast).toHaveBeenCalledWith('Food archived.', expect.any(Function))
    })

    const undoHandler = showUndoToast.mock.calls[0]?.[1] as () => Promise<void>
    await undoHandler()

    await waitFor(() => {
      expect(unarchiveCategory).toHaveBeenCalledWith(1)
      expect(refreshCategories).toHaveBeenCalledTimes(2)
      expect(refreshExpenses).toHaveBeenCalledTimes(2)
    })
  })

  it('keeps app-level delete behavior when onCategoriesChange is provided', async () => {
    const onCategoriesChange = vi.fn().mockResolvedValue(undefined)

    render(
      <CategoryModal
        categories={[
          { id: 1, name: 'Food', isArchived: false },
          { id: 2, name: 'Travel', isArchived: false },
        ]}
        onCategoriesChange={onCategoriesChange}
        onClose={vi.fn()}
      />,
    )

    const categoryRow = screen.getByTestId('category-row-1')
    fireEvent.click(within(categoryRow).getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByTestId('confirm-delete-entity'))

    await waitFor(() => {
      expect(onCategoriesChange).toHaveBeenCalledWith('delete', { id: 1 })
    })
    expect(deleteCategory).not.toHaveBeenCalled()
    expect(showUndoToast).not.toHaveBeenCalled()
  })
})
