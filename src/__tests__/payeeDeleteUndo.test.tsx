import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PayeeModal from '../features/payees/PayeeModal'
import PayeesPage from '../features/payees/PayeesPage'

const {
  getPayees,
  addPayee,
  updatePayee,
  archivePayee,
  unarchivePayee,
  getExpenseCountForPayee,
  mergePayee,
  revertPayeeMerge,
  showToast,
  showUndoToast,
  usePayeesState,
} = vi.hoisted(() => ({
  getPayees: vi.fn(),
  addPayee: vi.fn(),
  updatePayee: vi.fn(),
  archivePayee: vi.fn(),
  unarchivePayee: vi.fn(),
  getExpenseCountForPayee: vi.fn(),
  mergePayee: vi.fn(),
  revertPayeeMerge: vi.fn(),
  showToast: vi.fn(),
  showUndoToast: vi.fn(),
  usePayeesState: {
    payees: [
      { id: 1, name: 'Alpha', isArchived: false },
      { id: 2, name: 'Beta', isArchived: false },
    ],
    refresh: vi.fn(),
  },
}))

vi.mock('../services/storageService', () => ({
  StorageService: {
    getPayees,
    addPayee,
    updatePayee,
    archivePayee,
    unarchivePayee,
    getExpenseCountForPayee,
    mergePayee,
    revertPayeeMerge,
  },
}))

vi.mock('../context/toastContext', () => ({
  useToasts: () => ({
    showToast,
    showUndoToast,
    dismissToast: vi.fn(),
  }),
}))

vi.mock('../hooks/useLocalData', () => ({
  usePayees: () => usePayeesState,
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

describe('Payee delete + undo flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPayees.mockResolvedValue([
      { id: 1, name: 'Alpha', isArchived: false },
      { id: 2, name: 'Beta', isArchived: false },
    ])
    addPayee.mockResolvedValue(10)
    updatePayee.mockResolvedValue(undefined)
    archivePayee.mockResolvedValue(undefined)
    unarchivePayee.mockResolvedValue(undefined)
    getExpenseCountForPayee.mockResolvedValue(0)
    mergePayee.mockResolvedValue(1)
    revertPayeeMerge.mockResolvedValue(undefined)
    showUndoToast.mockReturnValue('toast-id')
    usePayeesState.payees = [
      { id: 1, name: 'Alpha', isArchived: false },
      { id: 2, name: 'Beta', isArchived: false },
    ]
    usePayeesState.refresh.mockReset()
  })

  it('PayeeModal archives with undo and refresh/sync callbacks', async () => {
    const onPayeesChange = vi.fn()
    const refreshPayees = vi.fn().mockResolvedValue(undefined)
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const triggerSync = vi.fn()

    render(
      <PayeeModal
        payees={[
          { id: 1, name: 'Alpha', isArchived: false },
          { id: 2, name: 'Beta', isArchived: false },
        ]}
        onPayeesChange={onPayeesChange}
        refreshPayees={refreshPayees}
        refreshExpenses={refreshExpenses}
        triggerSync={triggerSync}
        onClose={vi.fn()}
      />,
    )

    const alphaRow = screen.getByText('Alpha').closest('li')
    if (!alphaRow) {
      throw new Error('Expected payee row for Alpha')
    }
    fireEvent.click(within(alphaRow).getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByTestId('confirm-delete-entity'))

    await waitFor(() => {
      expect(archivePayee).toHaveBeenCalledWith(1)
      expect(onPayeesChange).toHaveBeenCalledTimes(1)
      expect(refreshPayees).toHaveBeenCalledTimes(1)
      expect(refreshExpenses).toHaveBeenCalledTimes(1)
      expect(triggerSync).toHaveBeenCalledTimes(1)
      expect(showUndoToast).toHaveBeenCalledWith('Payee archived.', expect.any(Function))
    })

    const undoHandler = showUndoToast.mock.calls[0]?.[1] as () => Promise<void>
    await undoHandler()

    await waitFor(() => {
      expect(unarchivePayee).toHaveBeenCalledWith(1)
      expect(onPayeesChange).toHaveBeenCalledTimes(2)
      expect(refreshPayees).toHaveBeenCalledTimes(2)
      expect(refreshExpenses).toHaveBeenCalledTimes(2)
      expect(triggerSync).toHaveBeenCalledTimes(2)
    })
  })

  it('PayeesPage archives with undo and refresh/sync callbacks', async () => {
    const refreshExpenses = vi.fn().mockResolvedValue(undefined)
    const triggerSync = vi.fn()

    render(<PayeesPage refreshExpenses={refreshExpenses} triggerSync={triggerSync} />)

    fireEvent.click(screen.getByTestId('btn-delete-payee-1'))
    fireEvent.click(screen.getByTestId('confirm-delete-entity'))

    await waitFor(() => {
      expect(archivePayee).toHaveBeenCalledWith(1)
      expect(usePayeesState.refresh).toHaveBeenCalledTimes(1)
      expect(refreshExpenses).toHaveBeenCalledTimes(1)
      expect(triggerSync).toHaveBeenCalledTimes(1)
      expect(showUndoToast).toHaveBeenCalledWith('Payee archived.', expect.any(Function))
    })

    const undoHandler = showUndoToast.mock.calls[0]?.[1] as () => Promise<void>
    await undoHandler()

    await waitFor(() => {
      expect(unarchivePayee).toHaveBeenCalledWith(1)
      expect(usePayeesState.refresh).toHaveBeenCalledTimes(2)
      expect(refreshExpenses).toHaveBeenCalledTimes(2)
      expect(triggerSync).toHaveBeenCalledTimes(2)
    })
  })
})
