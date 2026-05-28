import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '@/features/dashboard/Dashboard'
import { DASHBOARD_VIEWS } from '@/features/dashboard/constants'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'

const storageMocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setLocalSetting: vi.fn(),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}))

vi.mock('@/services/storageService', () => ({
  StorageService: {
    getSetting: storageMocks.getSetting,
    setLocalSetting: storageMocks.setLocalSetting,
  },
}))

vi.mock('@/context/settingsContext', () => ({
  useSettings: () => ({
    formatAmount: (n: number) => `$${n.toFixed(2)}`,
    getNumberColorClass: () => 'text-theme-text',
    formatDate: (iso: string) => iso,
  }),
}))

vi.mock('@/features/dashboard/hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}))

vi.mock('@/components/ui/PullToRefreshContainer', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({ default: () => null }))
vi.mock('@/components/privacy/PrivateValue', () => ({ default: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }))
vi.mock('@/features/dashboard/DashboardHeader', () => ({ default: () => null }))
vi.mock('@/features/dashboard/MonthSpanSelector', () => ({ default: () => null }))
vi.mock('@/features/dashboard/DashboardMonthStrip', () => ({ default: () => null }))
vi.mock('@/features/dashboard/CategoryViewTable', () => ({ default: () => null }))
vi.mock('@/features/dashboard/PayeeViewTable', () => ({ default: () => null }))
vi.mock('@/features/dashboard/ExpenseDrilldown', () => ({ default: () => null }))
vi.mock('@/features/dashboard/CheckInReminderCard', () => ({ default: () => null }))
vi.mock('@/features/dashboard/components/IncomeModalForm', () => ({ default: () => null }))
vi.mock('@/features/dashboard/components/SavingsModalForm', () => ({ default: () => null }))
vi.mock('@/features/dashboard/FilterModal', () => ({ default: () => null }))
vi.mock('@/features/dashboard/components/MobileSelectionBanner', () => ({ default: () => null }))
vi.mock('@/features/dashboard/ExpenseTable', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: React.forwardRef<HTMLDivElement>(() => <div data-testid="expenses-view" />),
  }
})

function makeDash() {
  return {
    viewportWidth: 1024,
    selectedYear: 2026,
    selectedMonth: 4,
    monthSpan: 1,
    showGrandTotal: false,
    setMonthSpan: vi.fn(),
    setShowGrandTotal: vi.fn(),
    monthStrip: [],
    stripMaxVisible: 7,
    yearFirstIndices: new Map(),
    monthKeys: [{ year: 2026, month: 4, key: '2026-05', name: 'May' }],
    navigateToMonth: vi.fn(),
    jumpToCurrentMonth: vi.fn(),
    goToPreviousMonth: vi.fn(),
    goToNextMonth: vi.fn(),
    isAtCurrentMonth: true,
    monthSummaries: [],
    financialSummary: null,
    daysLeft: 5,
    selectedCategories: new Set<number>(),
    setSelectedCategories: vi.fn(),
    activeFilterCount: 0,
    filteredExpenses: [{ id: 1, date: '2026-05-01', amount: 20, notes: 'A', categoryId: 1 }],
    expensesInSelectedSpan: [{ id: 1, date: '2026-05-01', amount: 20, notes: 'A', categoryId: 1 }],
    selectedIds: new Set<number>(),
    toggleExpenseSelection: vi.fn(),
    toggleSelectAll: vi.fn(),
    clearSelection: vi.fn(),
    isDeleteConfirmOpen: false,
    setIsDeleteConfirmOpen: vi.fn(),
    confirmBulkDelete: vi.fn(),
    viewMode: DASHBOARD_VIEWS.EXPENSES,
    setView: vi.fn(),
    viewAnimation: null,
    switchToCategories: vi.fn(),
    switchToPayees: vi.fn(),
    switchToExpenses: vi.fn(),
    swipeAreaRef: createRef<HTMLDivElement>(),
    scrollableRef: createRef<HTMLDivElement>(),
    handleTouchStart: vi.fn(),
    handleTouchEnd: vi.fn(),
    isFilterModalOpen: false,
    setIsFilterModalOpen: vi.fn(),
    isIncomeModalOpen: false,
    openIncomeModal: vi.fn(),
    closeIncomeModal: vi.fn(),
    handleIncomeSave: vi.fn(),
    getInitialIncomeAmount: vi.fn().mockReturnValue(''),
    incomeError: null,
    isSavingsModalOpen: false,
    openSavingsModal: vi.fn(),
    closeSavingsModal: vi.fn(),
    handleSavingsSave: vi.fn(),
    getInitialSavingsRate: vi.fn().mockReturnValue(''),
    savingsError: null,
    modalTargetMonthIndex: 0,
    spanVariableTotal: 20,
    expenseTagsMap: {},
    mobileEditTrigger: null,
    isSplitParentExpanded: vi.fn().mockReturnValue(true),
    toggleSplitParentExpanded: vi.fn(),
  } as unknown as ReturnType<typeof useDashboard>
}

describe('Dashboard view options', () => {
  beforeEach(() => {
    storageMocks.getSetting.mockReset()
    storageMocks.setLocalSetting.mockReset()
    storageMocks.getSetting.mockResolvedValue({ showNotesColumn: true, showTagsColumn: true })
    storageMocks.setLocalSetting.mockResolvedValue(undefined)
    vi.mocked(useDashboard).mockReturnValue(makeDash())
  })

  it('opens view options and persists toggles via setLocalSetting', async () => {
    render(
      <Dashboard
        expenses={[{ id: 1, date: '2026-05-01', amount: 20, notes: 'A', categoryId: 1 }]}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onBulkDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'View options' }))
    expect(screen.getByRole('dialog', { name: 'Table display' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show tags column' }))

    await waitFor(() => {
      expect(storageMocks.setLocalSetting).toHaveBeenCalledWith('dashboardExpenseTableDisplay', {
        showNotesColumn: true,
        showTagsColumn: false,
      })
    })
  })
})
