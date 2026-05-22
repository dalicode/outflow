import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import SettingsPage from '../features/settings/SettingsPage'
import { StorageService } from '../services/storageService'
import { useAuth } from '../context/authContext'

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
    save: vi.fn(),
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
  useScheduleList: () => ({
    schedules: [],
    loadSchedules: vi.fn(),
    deleteSchedule: vi.fn(),
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
  default: () => null,
}))

vi.mock('../features/settings/ScheduleModal', () => ({
  default: () => null,
}))

vi.mock('../features/settings/ThemeSelector', () => ({
  default: () => <div>Theme selector</div>,
}))

vi.mock('../features/settings/AboutSection', () => ({
  default: () => <div>About</div>,
}))

describe('SettingsPage', () => {
  beforeEach(() => {
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
