import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EditHistoricalDataModal from '../features/settings/EditHistoricalDataModal'

vi.mock('../context/settingsContext', () => ({
  useSettings: () => ({
    formatAmount: (value: number) => `$${value.toFixed(2)}`,
  }),
}))

const { storageMock, saveHistoricalSnapshotConfigs } = vi.hoisted(() => ({
  saveHistoricalSnapshotConfigs: vi.fn(async () => undefined),
  storageMock: {
    getFixedExpenses: vi.fn(async () => []),
    getAllIncomeSnapshots: vi.fn(async () => []),
    getAllSavingsSnapshots: vi.fn(async () => []),
    getAllFixedExpenseSnapshots: vi.fn(async () => []),
  },
}))

vi.mock('../context/financeDataContext', () => ({
  useFinanceActions: () => ({
    saveHistoricalSnapshotConfigs,
  }),
}))

vi.mock('../services/storageService', () => ({
  StorageService: storageMock,
}))

describe('EditHistoricalDataModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveHistoricalSnapshotConfigs.mockResolvedValue(undefined)
    localStorage.clear()
  })

  it('restores legacy draft payloads that still include saveMode', async () => {
    localStorage.setItem(
      'outflow:editHistoricalDraft:2025',
      JSON.stringify({
        yearConfigs: {
          2025: {
            incomeRanges: [{ id: 'i1', amount: '5000', startMonth: 1, endMonth: 1 }],
            savingsRanges: [],
            fixedItems: [],
          },
        },
        dirtyYears: [2025],
        saveMode: 'replace',
      }),
    )

    render(<EditHistoricalDataModal isOpen onClose={() => {}} years={[2025]} expenses={[]} />)

    await screen.findByText('Unsaved changes restored from your last session.')
    expect(screen.queryByText('Save mode')).toBeNull()
  })

  it('reloads db-backed values after discarding restored draft', async () => {
    storageMock.getAllIncomeSnapshots.mockResolvedValueOnce([{ year: 2025, month: 1, amountSnapshot: 4500 }])
    localStorage.setItem(
      'outflow:editHistoricalDraft:2025',
      JSON.stringify({
        yearConfigs: {
          2025: {
            incomeRanges: [{ id: 'i1', amount: '5000', startMonth: 1, endMonth: 1 }],
            savingsRanges: [],
            fixedItems: [],
          },
        },
        dirtyYears: [2025],
      }),
    )
    render(<EditHistoricalDataModal isOpen onClose={() => {}} years={[2025]} expenses={[]} />)
    await screen.findByText('Unsaved changes restored from your last session.')
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => {
      expect(screen.queryByText('Unsaved changes restored from your last session.')).toBeNull()
    })
    await waitFor(() => {
      expect(storageMock.getAllIncomeSnapshots).toHaveBeenCalledTimes(2)
    })
  })

  it('clears global no-change validation error after editing', async () => {
    render(<EditHistoricalDataModal isOpen onClose={() => {}} years={[2025]} expenses={[]} />)
    const saveButton = await screen.findByRole('button', { name: 'Confirm Save' })
    fireEvent.click(saveButton)
    await screen.findByText('No changes to save.')
    fireEvent.click(screen.getByRole('button', { name: '+ Add income range' }))
    await waitFor(() => {
      expect(screen.queryByText('No changes to save.')).toBeNull()
    })
  })

  it('loads fixed snapshot names when live fixed definition names differ', async () => {
    storageMock.getFixedExpenses.mockResolvedValueOnce([{ id: 11, name: 'Live Name', amount: 999 }])
    storageMock.getAllFixedExpenseSnapshots.mockResolvedValueOnce([
      { fixedExpenseId: 11, year: 2025, month: 1, amountSnapshot: 1200, nameSnapshot: 'Snapshot Name' },
    ])
    render(<EditHistoricalDataModal isOpen onClose={() => {}} years={[2025]} expenses={[]} />)
    expect(await screen.findByDisplayValue('Snapshot Name')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Live Name')).toBeNull()
  })

  it('keeps fixed snapshot name changes as separate historical rows', async () => {
    storageMock.getAllFixedExpenseSnapshots.mockResolvedValueOnce([
      { fixedExpenseId: 11, year: 2025, month: 1, amountSnapshot: 1200, nameSnapshot: 'Old Rent' },
      { fixedExpenseId: 11, year: 2025, month: 2, amountSnapshot: 1200, nameSnapshot: 'New Rent' },
    ])

    render(<EditHistoricalDataModal isOpen onClose={() => {}} years={[2025]} expenses={[]} />)

    expect(await screen.findByDisplayValue('Old Rent')).toBeInTheDocument()
    expect(screen.getByDisplayValue('New Rent')).toBeInTheDocument()
  })
})
