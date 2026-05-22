import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import SettingsPage from '../features/settings/SettingsPage'
import { StorageService } from '../services/storageService'
import { useAuth } from '../context/authContext'

const { settingsSave, loadSchedules, deleteSchedule } = vi.hoisted(() => ({
  settingsSave: vi.fn(),
  loadSchedules: vi.fn(),
  deleteSchedule: vi.fn(),
}))

vi.mock('../context/authContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../context/settingsContext', () => ({
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

vi.mock('../context/toastContext', () => ({
  useToasts: () => ({
    showToast: vi.fn(),
  }),
}))

vi.mock('../hooks/useLocalData', () => ({
  usePayees: () => ({ payees: [] }),
}))

vi.mock('../features/settings/hooks/useScheduleList', () => ({
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

vi.mock('../services/storageService', () => ({
  StorageService: {
    getCategories: vi.fn(),
    getSetting: vi.fn(),
  },
}))

vi.mock('../services/syncService', () => ({
  clearUserCloudData: vi.fn(),
}))

vi.mock('../features/importExport/hooks/useBackup', () => ({
  useBackup: () => ({}),
}))

vi.mock('../features/importExport/hooks/useCsvImport', () => ({
  useCsvImport: () => ({}),
}))

vi.mock('../components/inputs/DatePicker', () => ({
  default: () => <div>DatePicker</div>,
}))

vi.mock('../components/ui/Card', () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}))

vi.mock('../components/ui/LoadingOverlay', () => ({
  default: () => null,
}))

vi.mock('../features/importExport/ImportLogPanel', () => ({
  default: () => null,
}))

vi.mock('../features/importExport/ImportReviewModal', () => ({
  default: () => null,
}))

vi.mock('../features/settings/EditHistoricalDataModal', () => ({
  default: () => null,
}))

vi.mock('../features/settings/ScheduleList', () => ({
  default: ({ onDelete }: { onDelete: (id: number) => void }) => (
    <button type="button" onClick={() => onDelete(77)}>
      Delete schedule
    </button>
  ),
}))

vi.mock('../features/settings/ScheduleModal', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" onClick={onComplete}>
      Complete schedule
    </button>
  ),
}))

vi.mock('../features/settings/ThemeSelector', () => ({
  default: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange('sharpProfessionalDark')}>
      Theme selector
    </button>
  ),
}))

vi.mock('../features/settings/AboutSection', () => ({
  default: () => <div>About</div>,
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsSave.mockResolvedValue(undefined)
    deleteSchedule.mockResolvedValue(undefined)
    loadSchedules.mockResolvedValue(undefined)
    vi.mocked(StorageService.getCategories).mockResolvedValue([])
    vi.mocked(StorageService.getSetting).mockImplementation(
      async (_key: string, fallback?: unknown) => fallback,
    )
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'user@example.com' },
      signOut: vi.fn().mockResolvedValue({ error: null }),
      recoveryStatus: 'healthy',
      recoveryReport: null,
      runRecoveryCheck: vi.fn(),
      rebuildCloudFromLocal: vi.fn(),
    } as ReturnType<typeof useAuth>)
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

    fireEvent.click(screen.getByRole('button', { name: 'Complete schedule' }))

    await waitFor(() => {
      expect(loadSchedules).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(syncLocalChanges).toHaveBeenCalledTimes(1)
    })
  })

  it('asks for confirmation before signing out', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'user@example.com' },
      signOut,
      recoveryStatus: 'healthy',
      recoveryReport: null,
      runRecoveryCheck: vi.fn(),
      rebuildCloudFromLocal: vi.fn(),
    } as ReturnType<typeof useAuth>)

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
})
