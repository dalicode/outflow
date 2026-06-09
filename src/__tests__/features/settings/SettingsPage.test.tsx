import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import SettingsPage from '@/features/settings/SettingsPage'
import { useAuth } from '@/context/authContext'
import { getCategories } from '@/services/repositories/categoryRepository'
import { getSetting } from '@/services/repositories/settingsRepository'

const { settingsSave, loadSchedules, deleteSchedule } = vi.hoisted(() => ({
  settingsSave: vi.fn(),
  loadSchedules: vi.fn(),
  deleteSchedule: vi.fn(),
}))

const { runSnapshotMaintenance } = vi.hoisted(() => ({
  runSnapshotMaintenance: vi.fn(),
}))

const { showToast } = vi.hoisted(() => ({
  showToast: vi.fn(),
}))

const { getSyncPauseReasons } = vi.hoisted(() => ({
  getSyncPauseReasons: vi.fn(),
}))

vi.mock('@/context/authContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/context/settingsContext', () => ({
  useSettings: () => ({
    settings: {
      visualTheme: 'default',
      font: 'system',
      fontSize: '1',
      currencySymbol: '$',
      decimalPlaces: '2',
      thousandSep: ',',
      dateFormat: 'MM/DD/YYYY',
      hapticsEnabled: true,
    },
    save: settingsSave,
    formatDate: vi.fn((value: string) => value),
    formatAmount: vi.fn((value: number) => `$${value}`),
    currentTheme: { name: 'Default' },
  }),
}))

vi.mock('@/context/toastContext', () => ({
  useToasts: () => ({
    showToast,
  }),
}))

vi.mock('@/hooks/useLocalData', () => ({
  usePayees: () => ({ payees: [] }),
}))

vi.mock('@/hooks/useStartupSnapshots', () => ({
  runSnapshotMaintenance,
}))

vi.mock('@/features/settings/hooks/useScheduleList', () => ({
  useScheduleList: ({ onLocalMutation }: { onLocalMutation?: () => void } = {}) => ({
    schedules: [
      {
        id: 77,
        type: 'income',
        effectiveYear: 2026,
        effectiveMonth: 6,
        newValue: 5000,
        isActive: 1,
      },
    ],
    loadSchedules,
    deleteSchedule: async (id: number) => {
      await deleteSchedule(id)
      onLocalMutation?.()
    },
  }),
}))

vi.mock('@/services/repositories/categoryRepository', () => ({
  getCategories: vi.fn(),
}))

vi.mock('@/services/repositories/settingsRepository', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}))

vi.mock('@/services/repositories/backupRepository', () => ({
  clearAllData: vi.fn(),
  dbVersion: vi.fn(() => 7),
}))

vi.mock('@/services/syncService', () => ({
  clearUserCloudData: vi.fn(),
}))

vi.mock('@/features/importExport/hooks/useBackup', () => ({
  useBackup: () => ({}),
}))

vi.mock('@/features/importExport/hooks/useCsvImport', () => ({
  useCsvImport: () => ({}),
}))

vi.mock('@/services/syncRuntime', () => ({
  getSyncPauseReasons,
}))

vi.mock('@/components/inputs/DatePicker', () => ({
  default: () => <div>DatePicker</div>,
}))

vi.mock('@/components/ui/Card', () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}))

vi.mock('@/components/ui/LoadingOverlay', () => ({
  default: () => null,
}))

vi.mock('@/features/importExport/ImportLogPanel', () => ({
  default: () => null,
}))

vi.mock('@/features/importExport/ImportReviewModal', () => ({
  default: () => null,
}))

vi.mock('@/features/settings/EditHistoricalDataModal', () => ({
  default: () => null,
}))

vi.mock('@/features/settings/ScheduleList', () => ({
  default: ({ onDelete }: { onDelete: (id: number) => void }) => (
    <button type="button" onClick={() => onDelete(77)}>
      Delete schedule
    </button>
  ),
}))

vi.mock('@/features/settings/ScheduleModal', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" onClick={onComplete}>
      Complete schedule
    </button>
  ),
}))

vi.mock('@/features/settings/ThemeSelector', () => ({
  default: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange('sharpProfessionalDark')}>
      Theme selector
    </button>
  ),
}))

vi.mock('@/features/settings/AboutSection', () => ({
  default: () => <div>About</div>,
}))

function makeAuthValue(
  overrides: Partial<ReturnType<typeof useAuth>> = {},
): ReturnType<typeof useAuth> {
  return {
    user: { id: 'user-1', email: 'user@example.com' } as ReturnType<typeof useAuth>['user'],
    loading: false,
    syncStatus: 'idle',
    hasSynced: true,
    syncCount: 0,
    pullAppliedCount: 0,
    signOut: vi.fn().mockResolvedValue({ error: null }),
    recoveryStatus: 'healthy',
    recoveryReport: null,
    runRecoveryCheck: vi.fn(),
    rebuildCloudFromLocal: vi.fn(),
    restoreLocalFromCloud: vi.fn(),
    syncNow: vi.fn(),
    syncLocalThenPull: vi.fn(),
    syncLocalChanges: vi.fn(),
    triggerSync: vi.fn(),
    ...overrides,
  }
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsSave.mockResolvedValue(undefined)
    deleteSchedule.mockResolvedValue(undefined)
    loadSchedules.mockResolvedValue(undefined)
    runSnapshotMaintenance.mockResolvedValue({ appliedNotices: [], ran: false, succeeded: true })
    showToast.mockReset()
    window.sessionStorage.clear()
    getSyncPauseReasons.mockReturnValue([])
    vi.mocked(getCategories).mockResolvedValue([])
    vi.mocked(getSetting).mockImplementation(async (_key: string, fallback?: unknown) => fallback)
    vi.mocked(useAuth).mockReturnValue(makeAuthValue())
  })

  it('flushes local changes after appearance and preference settings saves', async () => {
    const syncLocalChanges = vi.fn().mockResolvedValue(undefined)

    render(<SettingsPage expenses={[]} syncLocalChanges={syncLocalChanges} />)

    fireEvent.click(screen.getByRole('button', { name: 'Theme selector' }))
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(settingsSave).toHaveBeenCalledWith({ visualTheme: 'sharpProfessionalDark' })
      expect(settingsSave).toHaveBeenCalledWith({ hapticsEnabled: false })
    })
    expect(syncLocalChanges).toHaveBeenCalledTimes(2)
  })

  it('flushes local changes after schedule delete', async () => {
    const syncLocalChanges = vi.fn().mockResolvedValue(undefined)

    render(<SettingsPage expenses={[]} syncLocalChanges={syncLocalChanges} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete schedule' }))

    await waitFor(() => {
      expect(deleteSchedule).toHaveBeenCalledWith(77)
    })
    await waitFor(() => {
      expect(syncLocalChanges).toHaveBeenCalledTimes(1)
    })
  })

  it('flushes local changes after schedule modal completion', async () => {
    const syncLocalChanges = vi.fn().mockResolvedValue(undefined)

    render(<SettingsPage expenses={[]} syncLocalChanges={syncLocalChanges} />)

    fireEvent.click(screen.getByRole('button', { name: '+ Add Schedule' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Complete schedule' }))

    await waitFor(() => {
      expect(loadSchedules).toHaveBeenCalled()
    })
    expect(runSnapshotMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({
        debugLabel: 'schedule-save-maintenance',
      }),
    )
    await waitFor(() => {
      expect(syncLocalChanges).toHaveBeenCalledTimes(1)
    })
  })

  it('asks for confirmation before signing out', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(useAuth).mockReturnValue(
      makeAuthValue({
        signOut,
      }),
    )

    render(<SettingsPage expenses={[]} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0])

    expect(signOut).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Sign out?')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1)
    })
  })

  it('shows progress feedback while diagnostics are running', async () => {
    let resolveDiagnostics: (() => void) | null = null
    const runRecoveryCheck = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDiagnostics = resolve
        }),
    )

    vi.mocked(useAuth).mockReturnValue(
      makeAuthValue({
        runRecoveryCheck,
      }),
    )

    render(<SettingsPage expenses={[]} />)

    fireEvent.click(screen.getByTestId('btn-open-recovery-modal'))
    fireEvent.click(await screen.findByRole('button', { name: 'Run diagnostics' }))

    expect(runRecoveryCheck).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith({
      message: 'Checking local and cloud data...',
      tone: 'default',
      durationMs: 4000,
    })
    expect(screen.getByRole('button', { name: 'Run diagnostics' })).toBeDisabled()
    expect(screen.queryByText('Checking local and cloud data...')).not.toBeInTheDocument()

    await act(async () => {
      resolveDiagnostics?.()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run diagnostics' })).toBeEnabled()
    })
  })

  it('renders active sync pause reasons in the recovery area and modal', async () => {
    getSyncPauseReasons.mockReturnValue(['another-pause', 'recovery'])
    vi.mocked(useAuth).mockReturnValue(
      makeAuthValue({
        recoveryStatus: 'local_repair_required',
        recoveryReport: {
          status: 'local_repair_required',
          issues: ['Local expense data is inconsistent'],
          localCounts: {
            expenses: 12,
            expenseSplits: 0,
            categories: 3,
            payees: 2,
            fixedExpenses: 1,
            fixedExpenseSnapshots: 0,
            incomeSnapshots: 0,
            savingsSnapshots: 0,
            schedules: 0,
            settings: 4,
          },
          cloudCounts: {
            expenses: 10,
            expenseSplits: 0,
            categories: 3,
            payees: 2,
            fixedExpenses: 1,
            fixedExpenseSnapshots: 0,
            incomeSnapshots: 0,
            savingsSnapshots: 0,
            schedules: 0,
            settings: 4,
          },
          brokenExpenseCategoryRefs: 0,
          brokenExpensePayeeRefs: 0,
          brokenExpenseSplitRefs: 0,
          duplicateIncomeSnapshots: 0,
          duplicateSavingsSnapshots: 0,
          duplicateFixedExpenseSnapshots: 0,
          duplicateCategoryNames: 0,
          duplicatePayeeNames: 0,
        },
      }),
    )

    render(<SettingsPage expenses={[]} />)

    expect(screen.getAllByText('Sync: paused').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Active pause reasons: recovery (local_repair_required), another-pause'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sync is paused by recovery status here, not by Firefox support.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-open-recovery-modal'))

    expect(screen.getByText('Active sync pause reasons')).toBeInTheDocument()
    expect(screen.getByText('recovery (local_repair_required)')).toBeInTheDocument()
    expect(screen.getByText('another-pause')).toBeInTheDocument()
    expect(
      screen.getByText('Recovery status is what pauses sync here, not Firefox support.'),
    ).toBeInTheDocument()
  })

  it('shows a session warning for local repair and opens Data Recovery from the action', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthValue({
        recoveryStatus: 'local_repair_required',
      }),
    )

    render(<SettingsPage expenses={[]} />)

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Local data needs repair before sync can continue.',
          tone: 'warning',
          actionLabel: 'Open recovery',
        }),
      )
    })

    const warningToast = showToast.mock.calls.find(
      ([toast]) => toast.message === 'Local data needs repair before sync can continue.',
    )?.[0]

    await act(async () => {
      await warningToast?.onAction?.()
    })

    expect(await screen.findByText('Data Recovery')).toBeInTheDocument()
    expect(window.sessionStorage.getItem('outflow-local-repair-warning-acknowledged')).toBe('1')
  })

  it('shows Restore local from cloud for local repair status', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthValue({
        recoveryStatus: 'local_repair_required',
      }),
    )

    render(<SettingsPage expenses={[]} />)

    fireEvent.click(screen.getByTestId('btn-open-recovery-modal'))

    expect(
      await screen.findByRole('button', { name: 'Restore local from cloud' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rebuild cloud' })).not.toBeInTheDocument()
  })

  it('shows Rebuild cloud for rebuild cloud required status', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthValue({
        recoveryStatus: 'rebuild_cloud_required',
      }),
    )

    render(<SettingsPage expenses={[]} />)

    fireEvent.click(screen.getByTestId('btn-open-recovery-modal'))

    expect(await screen.findByRole('button', { name: 'Rebuild cloud' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Restore local from cloud' }),
    ).not.toBeInTheDocument()
  })

  it('shows a session warning for rebuild cloud and opens Data Recovery from the action', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthValue({
        recoveryStatus: 'rebuild_cloud_required',
      }),
    )

    render(<SettingsPage expenses={[]} />)

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cloud data needs to be rebuilt from this device before sync can continue.',
          tone: 'warning',
          actionLabel: 'Open recovery',
        }),
      )
    })

    const warningToast = showToast.mock.calls.find(
      ([toast]) =>
        toast.message === 'Cloud data needs to be rebuilt from this device before sync can continue.',
    )?.[0]

    await act(async () => {
      await warningToast?.onAction?.()
    })

    expect(await screen.findByText('Data Recovery')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Rebuild cloud' })).toBeInTheDocument()
    expect(window.sessionStorage.getItem('outflow-rebuild-cloud-warning-acknowledged')).toBe('1')
  })

  it('confirms restore from cloud and refreshes app data on success', async () => {
    const restoreLocalFromCloud = vi.fn().mockResolvedValue(undefined)
    const onRefreshAll = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue(
      makeAuthValue({
        recoveryStatus: 'local_repair_required',
        restoreLocalFromCloud,
      }),
    )

    render(<SettingsPage expenses={[]} onRefreshAll={onRefreshAll} />)

    fireEvent.click(screen.getByTestId('btn-open-recovery-modal'))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore local from cloud' }))
    expect(await screen.findByText('Restore Local From Cloud')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Restore Local' }))

    await waitFor(() => {
      expect(restoreLocalFromCloud).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(onRefreshAll).toHaveBeenCalledTimes(1)
    })
    expect(showToast).toHaveBeenCalledWith({
      message: 'Local data restored from cloud.',
      tone: 'success',
    })
  })

  it('does not allow signed-out users to restore local data from cloud', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthValue({
        user: null,
        recoveryStatus: 'local_repair_required',
      }),
    )

    render(<SettingsPage expenses={[]} />)

    fireEvent.click(screen.getByTestId('btn-open-recovery-modal'))

    expect(await screen.findByRole('button', { name: 'Restore local from cloud' })).toBeDisabled()
  })
})
