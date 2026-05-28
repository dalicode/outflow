import { act, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '@/features/dashboard/Dashboard'
import { DASHBOARD_VIEWS } from '@/features/dashboard/constants'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import { StorageService } from '@/services/storageService'
import type { Expense } from '@/types'

const mocks = vi.hoisted(() => ({
  categoryViewSpy: vi.fn(),
  payeeViewSpy: vi.fn(),
  drilldownSpy: vi.fn(),
  expenseTableSpy: vi.fn(),
  mobileSelectionBannerSpy: vi.fn(),
  handleEditRequest: vi.fn(),
  handleSplitEditRequest: vi.fn(),
  handleCopyRequest: vi.fn(),
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

vi.mock('@/services/storageService', () => ({
  StorageService: {
    getSetting: vi.fn().mockResolvedValue({ showNotesColumn: true, showTagsColumn: true }),
    setLocalSetting: vi.fn().mockResolvedValue(undefined),
    getActiveTags: vi.fn(),
    getExpenseTagsMap: vi.fn(),
  },
}))

vi.mock('@/components/ui/PullToRefreshContainer', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard">{children}</div>
  ),
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
  default: () => null,
}))

vi.mock('@/components/privacy/PrivateValue', () => ({
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/features/dashboard/DashboardHeader', () => ({
  default: () => <div data-testid="dashboard-header" />,
}))

vi.mock('@/features/dashboard/MonthSpanSelector', () => ({
  default: () => <div data-testid="month-span-selector" />,
}))

vi.mock('@/features/dashboard/DashboardMonthStrip', () => ({
  default: () => <div data-testid="month-strip" />,
}))

vi.mock('@/features/dashboard/DashboardViewTabs', () => ({
  default: () => <div data-testid="view-tabs" />,
}))

vi.mock('@/features/dashboard/CategoryViewTable', () => ({
  default: (props: {
    multiCategoryRows: Array<{ name: string }>
    multiFixedRows: Array<{ name: string }>
  }) => {
    mocks.categoryViewSpy(props)
    return (
      <div data-testid="category-view">
        {props.multiCategoryRows.map((row) => (
          <span key={row.name}>{row.name}</span>
        ))}
        {props.multiFixedRows.map((row) => (
          <span key={row.name}>{row.name}</span>
        ))}
      </div>
    )
  },
}))

vi.mock('@/features/dashboard/PayeeViewTable', () => ({
  default: (props: {
    multiPayeeRows: Array<{ name: string }>
    multiFixedRows: Array<{ name: string }>
  }) => {
    mocks.payeeViewSpy(props)
    return (
      <div data-testid="payee-view">
        {props.multiPayeeRows.map((row) => (
          <span key={row.name}>{row.name}</span>
        ))}
        {props.multiFixedRows.map((row) => (
          <span key={row.name}>{row.name}</span>
        ))}
      </div>
    )
  },
}))

vi.mock('@/features/dashboard/ExpenseDrilldown', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  return {
    default: React.forwardRef<
      HTMLDivElement,
      {
        expenses: Expense[]
        secondColumn: 'payee' | 'category'
        resolveName: (expense: Expense) => string
        resolvePayeeName?: (expense: Expense) => string
      }
    >((props, ref) => {
      mocks.drilldownSpy(props)
      const firstExpense = props.expenses[0]
      const secondColumnValue =
        firstExpense && props.secondColumn === 'payee'
          ? props.resolvePayeeName?.(firstExpense)
          : firstExpense
            ? props.resolveName(firstExpense)
            : ''

      return (
        <div ref={ref} data-testid={`${props.secondColumn}-drilldown`}>
          <span>{secondColumnValue}</span>
        </div>
      )
    }),
  }
})

vi.mock('@/features/dashboard/ExpenseTable', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  return {
    default: React.forwardRef<
      {
        handleEditRequest: (ids: number[]) => void
        handleSplitEditRequest: (splitId: number) => void
        handleCopyRequest: (ids: number[]) => Promise<void>
      },
      {
        expenses: Expense[]
        onMobileSplitParentSelectionChange?: (splitId: number | null) => void
      }
    >((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        handleEditRequest: mocks.handleEditRequest,
        handleSplitEditRequest: mocks.handleSplitEditRequest,
        handleCopyRequest: mocks.handleCopyRequest,
      }))
      mocks.expenseTableSpy(props)
      return (
        <div data-testid="expenses-view">
          {props.expenses.map((expense) => (
            <span key={expense.id}>{expense.notes}</span>
          ))}
        </div>
      )
    }),
  }
})

vi.mock('@/features/dashboard/CheckInReminderCard', () => ({
  default: () => null,
}))

vi.mock('@/features/dashboard/components/IncomeModalForm', () => ({
  default: () => null,
}))

vi.mock('@/features/dashboard/components/SavingsModalForm', () => ({
  default: () => null,
}))

vi.mock('@/features/dashboard/FilterModal', () => ({
  default: () => null,
}))

vi.mock('@/features/dashboard/components/MobileSelectionBanner', () => ({
  default: (props: { onEdit: () => void }) => {
    mocks.mobileSelectionBannerSpy(props)
    return (
      <button type="button" onClick={props.onEdit}>
        Trigger Edit
      </button>
    )
  },
}))

type DashboardState = ReturnType<typeof useDashboard>

const categoryExpense: Expense = {
  id: 1,
  date: '2026-05-03',
  amount: 45,
  categoryId: 10,
  payeeId: 20,
  notes: 'Category drilldown expense',
}

const payeeExpense: Expense = {
  id: 2,
  date: '2026-05-04',
  amount: 32,
  categoryId: 11,
  payeeId: 21,
  notes: 'Payee drilldown expense',
}

function makeDash(overrides: Partial<DashboardState> = {}): DashboardState {
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
    monthSummaries: [
      {
        income: 5000,
        fixedExpensesTotal: 1000,
        savingsRate: 20,
        autoSavings: 1000,
        remaining: 2900,
        variableExpenses: 100,
        fixedExpenses: [],
      },
    ],
    financialSummary: null,
    daysLeft: 10,
    incomeRaw: '',
    incomeFrequency: 'monthly',
    filterGlobal: '',
    setFilterGlobal: vi.fn(),
    filterDateFrom: '',
    setFilterDateFrom: vi.fn(),
    filterDateTo: '',
    setFilterDateTo: vi.fn(),
    selectedCategories: new Set(),
    setSelectedCategories: vi.fn(),
    selectedPayees: new Set(),
    setSelectedPayees: vi.fn(),
    filterNotes: '',
    setFilterNotes: vi.fn(),
    filterAmount: '',
    setFilterAmount: vi.fn(),
    activeFilterCount: 0,
    filteredExpenses: [categoryExpense, payeeExpense],
    expensesInSelectedSpan: [categoryExpense, payeeExpense],
    getExpenseCategoryName: (expense: Expense) =>
      expense.categoryId === 10 ? 'Groceries' : 'Dining',
    selectedIds: new Set(),
    toggleExpenseSelection: vi.fn(),
    toggleSelectAll: vi.fn(),
    clearSelection: vi.fn(),
    isDeleteConfirmOpen: false,
    setIsDeleteConfirmOpen: vi.fn(),
    openDeleteConfirmation: vi.fn(),
    confirmBulkDelete: vi.fn(),
    viewMode: DASHBOARD_VIEWS.CATEGORIES,
    setView: vi.fn(),
    viewAnimation: null,
    switchToCategories: vi.fn(),
    switchToPayees: vi.fn(),
    switchToExpenses: vi.fn(),
    drilldownCategory: null,
    drilldownCategoryMonthIndex: 0,
    handleCategoryClick: vi.fn(),
    closeDrilldown: vi.fn(),
    drilldownPayee: null,
    drilldownPayeeMonthIndex: 0,
    handlePayeeClick: vi.fn(),
    closePayeeDrilldown: vi.fn(),
    swipeAreaRef: createRef<HTMLDivElement>(),
    scrollableRef: createRef<HTMLDivElement>(),
    drilldownRef: createRef<HTMLDivElement>(),
    handleTouchStart: vi.fn(),
    handleTouchEnd: vi.fn(),
    isIncomeModalOpen: false,
    openIncomeModal: vi.fn(),
    closeIncomeModal: vi.fn(),
    handleIncomeSave: vi.fn(),
    getInitialIncomeAmount: () => '',
    incomeError: null,
    isSavingsModalOpen: false,
    openSavingsModal: vi.fn(),
    closeSavingsModal: vi.fn(),
    handleSavingsSave: vi.fn(),
    getInitialSavingsRate: () => '',
    savingsError: null,
    modalTargetMonthIndex: 0,
    isFilterModalOpen: false,
    setIsFilterModalOpen: vi.fn(),
    multiCategoryRows: [{ name: 'Groceries', totalTransactions: 1, monthlyAmounts: [45] }],
    multiFixedRows: [{ id: 1, name: 'Rent', monthlyAmounts: [1000] }],
    multiPayeeRows: [{ name: 'Market', totalTransactions: 1, monthlyAmounts: [45] }],
    getExpensePayeeName: (expense: Expense) => (expense.payeeId === 20 ? 'Market' : 'Cafe'),
    drilldownExpenses: [categoryExpense],
    drilldownPayeeExpenses: [payeeExpense],
    groupedDrilldownExpenses: [],
    spanVariableTotal: 77,
    mobileEditTrigger: null,
    refreshData: vi.fn(),
    triggerMobileEdit: vi.fn(),
    setMobileEditTrigger: vi.fn(),
    ...overrides,
  } as DashboardState
}

function renderDashboard(state: DashboardState) {
  vi.mocked(useDashboard).mockReturnValue(state)

  return render(
    <Dashboard
      expenses={[categoryExpense, payeeExpense]}
      categories={[{ id: 10, name: 'Groceries' }]}
      payees={[{ id: 20, name: 'Market' }]}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
      onBulkDelete={vi.fn()}
    />,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(StorageService.getSetting).mockResolvedValue({
      showNotesColumn: true,
      showTagsColumn: true,
    })
    mocks.categoryViewSpy.mockReset()
    mocks.payeeViewSpy.mockReset()
    mocks.drilldownSpy.mockReset()
    mocks.expenseTableSpy.mockReset()
    mocks.mobileSelectionBannerSpy.mockReset()
    mocks.handleEditRequest.mockReset()
    mocks.handleSplitEditRequest.mockReset()
    mocks.handleCopyRequest.mockReset()
    mocks.handleCopyRequest.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the category view using dashboard-derived rows and payee drilldown resolution', () => {
    renderDashboard(
      makeDash({
        viewMode: DASHBOARD_VIEWS.CATEGORIES,
        drilldownCategory: 'Groceries',
      }),
    )

    expect(screen.getByTestId('category-view')).toHaveTextContent('Groceries')
    expect(screen.getByTestId('category-view')).toHaveTextContent('Rent')
    expect(screen.getByText('$77.00')).toBeInTheDocument()
    expect(screen.getByTestId('payee-drilldown')).toHaveTextContent('Market')
    expect(mocks.categoryViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        multiCategoryRows: expect.arrayContaining([expect.objectContaining({ name: 'Groceries' })]),
        multiFixedRows: expect.arrayContaining([expect.objectContaining({ name: 'Rent' })]),
      }),
    )
    expect(mocks.drilldownSpy).toHaveBeenCalledWith(
      expect.objectContaining({ secondColumn: 'payee' }),
    )
  })

  it('renders the payee view using dashboard-derived rows and category drilldown resolution', () => {
    renderDashboard(
      makeDash({
        viewMode: DASHBOARD_VIEWS.PAYEES,
        drilldownPayee: 'Cafe',
      }),
    )

    expect(screen.getByTestId('payee-view')).toHaveTextContent('Market')
    expect(screen.getByTestId('payee-view')).toHaveTextContent('Rent')
    expect(screen.getByTestId('category-drilldown')).toHaveTextContent('Dining')
    expect(mocks.payeeViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        multiPayeeRows: expect.arrayContaining([expect.objectContaining({ name: 'Market' })]),
        multiFixedRows: expect.arrayContaining([expect.objectContaining({ name: 'Rent' })]),
      }),
    )
    expect(mocks.drilldownSpy).toHaveBeenCalledWith(
      expect.objectContaining({ secondColumn: 'category' }),
    )
  })

  it('renders the expense view with filtered expenses from the dashboard hook', () => {
    renderDashboard(makeDash({ viewMode: DASHBOARD_VIEWS.EXPENSES }))

    expect(screen.getByTestId('expenses-view')).toHaveTextContent('Category drilldown expense')
    expect(screen.getByTestId('expenses-view')).toHaveTextContent('Payee drilldown expense')
    expect(mocks.expenseTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({ expenses: [categoryExpense, payeeExpense] }),
    )
  })

  it('routes mobile banner edit to split editor for one full split-parent selection', () => {
    const setMobileEditTrigger = vi.fn()
    renderDashboard(
      makeDash({
        viewMode: DASHBOARD_VIEWS.EXPENSES,
        viewportWidth: 375,
        selectedIds: new Set([1, 2]),
        setMobileEditTrigger,
      }),
    )

    const expensesViewProps = mocks.expenseTableSpy.mock.calls.at(-1)?.[0] as {
      onMobileSplitParentSelectionChange?: (splitId: number | null) => void
    }
    act(() => {
      expensesViewProps.onMobileSplitParentSelectionChange?.(10)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Edit' }))

    expect(mocks.handleSplitEditRequest).toHaveBeenCalledWith(10)
    expect(mocks.handleEditRequest).not.toHaveBeenCalled()
    expect(setMobileEditTrigger).not.toHaveBeenCalled()
  })

  it('keeps scrollbar auto-hide mobile-only and toggles scrolling visibility on activity', () => {
    const { container, rerender } = renderDashboard(
      makeDash({
        viewMode: DASHBOARD_VIEWS.EXPENSES,
        viewportWidth: 375,
      }),
    )

    const scrollableContent = container.querySelector('.overflow-y-auto')
    expect(scrollableContent).toBeTruthy()
    expect(scrollableContent?.className).toContain('scrollbar-auto-hide')
    expect(scrollableContent?.className).not.toContain('is-scrolling')

    if (!scrollableContent) {
      throw new Error('Expected dashboard scrollable content to render')
    }

    fireEvent.scroll(scrollableContent)
    expect(scrollableContent.className).toContain('is-scrolling')

    act(() => {
      vi.advanceTimersByTime(801)
    })
    expect(scrollableContent.className).not.toContain('is-scrolling')

    vi.mocked(useDashboard).mockReturnValue(
      makeDash({
        viewMode: DASHBOARD_VIEWS.EXPENSES,
        viewportWidth: 1024,
      }),
    )

    rerender(
      <Dashboard
        expenses={[categoryExpense, payeeExpense]}
        categories={[{ id: 10, name: 'Groceries' }]}
        payees={[{ id: 20, name: 'Market' }]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onBulkDelete={vi.fn()}
      />,
    )

    const desktopScrollableContent = container.querySelector('.overflow-y-auto')
    expect(desktopScrollableContent?.className).not.toContain('scrollbar-auto-hide')
  })
})
