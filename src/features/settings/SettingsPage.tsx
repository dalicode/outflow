import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import './settings.css'
import DatePicker from '../../components/inputs/DatePicker'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LazyModalFallback from '../../components/ui/LazyModalFallback'
import LoadingOverlay from '../../components/ui/LoadingOverlay'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import { useAuth } from '../../context/authContext'
import { useSettings } from '../../context/settingsContext'
import { useToasts } from '../../context/toastContext'
import { usePayees } from '../../hooks/useLocalData'
import { useScheduleList } from './hooks/useScheduleList'
import { clearAllData, dbVersion } from '../../services/repositories/backupRepository'
import { getCategories } from '../../services/repositories/categoryRepository'
import { getSetting, setSetting } from '../../services/repositories/settingsRepository'
import { clearUserCloudData } from '../../services/syncService'
import type { Category, Expense, Schedule, ScheduleMaterializationNotice } from '../../types'
import { getLocalToday } from '../../utils/historicalDataHelpers'
import { useBackup } from '../importExport/hooks/useBackup'
import { useCsvImport } from '../importExport/hooks/useCsvImport'
import ImportLogPanel from '../importExport/ImportLogPanel'
import { downloadCSV, expenseToRow } from '../importExport/utils/csvHelpers'
import ScheduleList from './ScheduleList'
import ThemeSelector from './ThemeSelector'
import AboutSection from './AboutSection'
import SettingsSelectRow, {
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  DECIMAL_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  THOUSAND_SEPARATOR_OPTIONS,
} from './components/SettingsSelectRow'

const ImportReviewModal = lazy(() => import('../importExport/ImportReviewModal'))
const EditHistoricalDataModal = lazy(() => import('./EditHistoricalDataModal'))
const ScheduleModal = lazy(() => import('./ScheduleModal'))

interface SettingsPageProps {
  expenses: Expense[]
  onImport?: () => Promise<void> | void
  onRefreshAll?: () => Promise<void> | void
  triggerSync?: () => void
  syncNow?: () => Promise<void>
  syncLocalThenPull?: () => Promise<void>
  syncLocalChanges?: () => Promise<void>
  showSignIn?: boolean
  onSignIn?: () => void
}

export default function SettingsPage({
  expenses,
  onRefreshAll,
  triggerSync,
  syncNow,
  syncLocalThenPull,
  syncLocalChanges,
  showSignIn,
  onSignIn,
}: SettingsPageProps) {
  const { settings, save, formatDate, formatAmount, currentTheme } = useSettings()
  const { user, signOut, recoveryStatus, recoveryReport, runRecoveryCheck, rebuildCloudFromLocal } =
    useAuth()
  const { showToast } = useToasts()
  const { payees } = usePayees()

  const [importStatus, setImportStatus] = useState('')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [editHistoricalDataYears, setEditHistoricalDataYears] = useState<number[]>([])
  const [showHistoricalCompletionPrompt, setShowHistoricalCompletionPrompt] = useState(false)
  const [isHistoricalDataModalOpen, setIsHistoricalDataModalOpen] = useState(false)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [scheduleToEdit, setScheduleToEdit] = useState<Schedule | null>(null)
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [savingsRate, setSavingsRate] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [appliedScheduleNotices, setAppliedScheduleNotices] = useState<
    ScheduleMaterializationNotice[]
  >([])
  const [exportRange, setExportRange] = useState({ from: '', to: '' })
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [csvCategories, setCsvCategories] = useState<Category[]>([])
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [isClearReloading, setIsClearReloading] = useState(false)
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false)
  const [isRebuildCloudModalOpen, setIsRebuildCloudModalOpen] = useState(false)
  const [isRebuildingCloud, setIsRebuildingCloud] = useState(false)
  const [isRunningRecoveryCheck, setIsRunningRecoveryCheck] = useState(false)
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false)

  const queueLocalSync = useCallback(() => {
    if (syncLocalChanges) {
      void syncLocalChanges()
      return
    }
    triggerSync?.()
  }, [syncLocalChanges, triggerSync])

  const { schedules, loadSchedules, deleteSchedule } = useScheduleList({
    onLocalMutation: queueLocalSync,
  })
  const backup = useBackup({
    user,
    onStatus: setImportStatus,
    onRefreshAll,
    triggerSync: queueLocalSync,
  })

  const handleImportComplete = async (importedYears: number[]) => {
    if (importedYears.length > 0) {
      setEditHistoricalDataYears(importedYears)
      setShowHistoricalCompletionPrompt(true)
    }
    await onRefreshAll?.()
  }

  const csvImport = useCsvImport({
    onImportComplete: handleImportComplete,
    onStatusChange: setImportStatus,
    onErrorsChange: setImportErrors,
    triggerSync: queueLocalSync,
  })

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])
  useEffect(() => {
    getSetting<ScheduleMaterializationNotice[]>('scheduleMaterializationLog', []).then((log) => {
      setAppliedScheduleNotices(Array.isArray(log) ? log : [])
    })
  }, [])
  useEffect(() => {
    Promise.all([getSetting('monthlyIncome', 0), getSetting('savingsRate', 0)]).then(
      ([income, rate]) => {
        setMonthlyIncome(String((income as number | null) ?? ''))
        setSavingsRate(String((rate as number | null) ?? ''))
      },
    )
  }, [])
  useEffect(() => {
    getCategories().then(setCsvCategories)
  }, [])

  const dismissHistoricalCompletionPrompt = () => {
    setShowHistoricalCompletionPrompt(false)
    showToast({
      message: 'You can reopen this later in Settings under the Historical Data card.',
      tone: 'default',
      durationMs: 7000,
    })
  }

  const reviewHistoricalData = () => {
    setShowHistoricalCompletionPrompt(false)
    setIsHistoricalDataModalOpen(true)
  }

  const handleEditSchedule = (schedule: Schedule) => {
    setScheduleToEdit(schedule)
    setIsScheduleModalOpen(true)
  }
  const handleAddSchedule = () => {
    setScheduleToEdit(null)
    setIsScheduleModalOpen(true)
  }
  const handleScheduleModalClose = () => {
    setIsScheduleModalOpen(false)
    setScheduleToEdit(null)
  }

  const handleDismissAppliedScheduleNotices = async () => {
    await setSetting('scheduleMaterializationLog', [])
    setAppliedScheduleNotices([])
    queueLocalSync()
  }

  const saveSyncedSettings = useCallback(
    async (patch: Parameters<typeof save>[0]) => {
      await save(patch)
      queueLocalSync()
    },
    [queueLocalSync, save],
  )

  const handleDeleteSchedule = useCallback(
    async (id: number) => {
      await deleteSchedule(id)
    },
    [deleteSchedule],
  )

  const handleClearAll = async () => {
    try {
      if (user?.id) {
        await clearUserCloudData(user.id)
      }
      await clearAllData()
      setImportStatus(
        user?.id
          ? 'All local and cloud data cleared successfully.'
          : 'All local data cleared successfully.',
      )
      await onRefreshAll?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      showToast({
        message: user?.id
          ? `Failed to clear all data: ${message}`
          : `Failed to clear local data: ${message}`,
        tone: 'danger',
      })
      throw error
    }
  }

  const triggerClearReload = useCallback(() => {
    setIsClearReloading(true)
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }, [])

  const handleCsvExport = () => {
    const catMap = Object.fromEntries(csvCategories.map((c) => [c.id as number, c.name]))
    const payeeMap = Object.fromEntries(payees.map((p) => [p.id as number, p.name]))
    let rows = expenses
    if (exportRange.from) rows = rows.filter((e) => e.date >= exportRange.from)
    if (exportRange.to) rows = rows.filter((e) => e.date <= exportRange.to)
    const csvRows = rows.map((e) => expenseToRow(e, catMap, payeeMap, formatDate))
    downloadCSV(csvRows, `expenses-${getLocalToday()}.csv`)
    setShowCsvModal(false)
  }

  const handleCloseCsvModal = () => {
    setShowCsvModal(false)
    setExportRange({ from: '', to: '' })
  }

  const handleRunRecoveryCheck = async () => {
    setIsRunningRecoveryCheck(true)
    try {
      showToast({
        message: 'Checking local and cloud data...',
        tone: 'default',
        durationMs: 4000,
      })
      await runRecoveryCheck()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      showToast({
        message: `Failed to run diagnostics: ${message}`,
        tone: 'danger',
      })
    } finally {
      setIsRunningRecoveryCheck(false)
    }
  }

  const availableYears = useMemo(() => {
    const expenseYears = [...new Set(expenses.map((e) => parseInt(e.date.slice(0, 4), 10)))].sort(
      (a, b) => a - b,
    )
    if (editHistoricalDataYears.length === 0) return expenseYears
    const importedYearSet = new Set(editHistoricalDataYears)
    return [
      ...editHistoricalDataYears,
      ...expenseYears.filter((year) => !importedYearSet.has(year)),
    ]
  }, [editHistoricalDataYears, expenses])

  return (
    <main className="w-full mx-auto max-w-4xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-theme-text tracking-tight">Settings</h1>

      <div className="mx-auto md:max-w-3xl flex flex-col space-y-6">
        {/* ── APPEARANCE ── */}
        <Card title="Appearance" variant="flat">
          <ThemeSelector
            value={settings.visualTheme}
            onChange={(v) => void saveSyncedSettings({ visualTheme: v })}
          />
          <div className="flex items-center gap-2 text-xs text-theme-muted mt-2">
            <span className="inline-block w-2 h-2 rounded-full bg-theme-success" />
            Active: <span className="font-medium text-theme-text">{currentTheme.name}</span>
          </div>

          <div className="border-t border-theme-border mt-4 mb-3" />
          <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
            Display
          </p>

          <SettingsSelectRow
            label="Font"
            value={settings.font}
            onChange={(v) => void saveSyncedSettings({ font: v })}
            options={FONT_OPTIONS}
          />
          <SettingsSelectRow
            label="Font size"
            value={settings.fontSize}
            onChange={(v) => void saveSyncedSettings({ fontSize: v })}
            options={FONT_SIZE_OPTIONS}
          />
          <SettingsSelectRow
            label="Currency"
            value={settings.currencySymbol}
            onChange={(v) => void saveSyncedSettings({ currencySymbol: v })}
            options={CURRENCY_OPTIONS}
          />
          <SettingsSelectRow
            label="Decimals"
            value={settings.decimalPlaces}
            onChange={(v) => void saveSyncedSettings({ decimalPlaces: v })}
            options={DECIMAL_OPTIONS}
          />
          <SettingsSelectRow
            label="Separator"
            value={settings.thousandSep}
            onChange={(v) => void saveSyncedSettings({ thousandSep: v })}
            options={THOUSAND_SEPARATOR_OPTIONS}
          />
          <SettingsSelectRow
            label="Date format"
            value={settings.dateFormat}
            onChange={(v) => void saveSyncedSettings({ dateFormat: v })}
            options={DATE_FORMAT_OPTIONS}
          />
          <p className="text-xs text-theme-muted mt-2">
            Preview: {formatAmount(1234567.89)} · {formatDate(getLocalToday())}
          </p>
        </Card>

        {/* ── PREFERENCES ── */}
        <Card title="Preferences" variant="flat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-theme-muted uppercase tracking-wider mb-2 font-semibold">
                Haptics
              </p>
              <p className="text-xs text-theme-muted">Vibration feedback on mobile actions</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.hapticsEnabled}
              onClick={() => void saveSyncedSettings({ hapticsEnabled: !settings.hapticsEnabled })}
              className="settings-toggle"
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>
        </Card>

        {/* ── ACCOUNT ── */}
        <Card title="Account" variant="flat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
                Cloud Sync
              </p>
              <p className="text-xs text-theme-muted mt-0.5">
                {user ? `Syncing as ${user.email}` : 'Sync your data across devices by signing in.'}
              </p>
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => setIsSignOutConfirmOpen(true)}
                className="settings-action-btn shrink-0 ml-4"
              >
                Sign out
              </button>
            ) : (
              showSignIn &&
              onSignIn && (
                <button type="button" onClick={onSignIn} className="btn-primary-sm shrink-0">
                  Sign in
                </button>
              )
            )}
          </div>
        </Card>

        <ConfirmDialog
          isOpen={isSignOutConfirmOpen}
          onClose={() => setIsSignOutConfirmOpen(false)}
          title="Sign out?"
          description="You’ll need to sign back in to resume cloud sync on this device."
          cancelLabel="Cancel"
          confirmLabel="Sign out"
          confirmVariant="destructive"
          onConfirm={() => {
            void signOut().then(({ error }) => {
              if (error) showToast({ message: error.message, tone: 'danger' })
            })
          }}
        />

        {/* ── DATA ── */}
        <Card title="Data" variant="flat">
          <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
            Historical Data
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-theme-muted">
              Edit income, savings rate, and fixed expenses for past years.
            </p>
            <button
              onClick={() => setIsHistoricalDataModalOpen(true)}
              data-testid="btn-open-historical-data"
              className="settings-action-btn shrink-0 ml-4"
            >
              Edit
            </button>
          </div>

          <div className="border-t border-theme-border mt-3 mb-3" />
          <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
            Scheduled Changes
          </p>
          <ScheduleList
            schedules={schedules}
            categories={categories}
            onEdit={handleEditSchedule}
            onDelete={handleDeleteSchedule}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-theme-muted">
              Plan future changes to income, savings, and expenses.
            </p>
            <button
              onClick={handleAddSchedule}
              data-testid="btn-add-schedule"
              className="settings-action-btn shrink-0 ml-4"
            >
              + Add Schedule
            </button>
          </div>

          <div className="border-t border-theme-border mt-3 mb-3" />
          <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
            Recovery
          </p>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-theme-muted">
                Local data is the source of truth. Use recovery to inspect sync health and rebuild
                cloud data from local when needed.
              </p>
              <p className="mt-1 text-xs font-medium text-theme-text">
                Health: {recoveryStatus}
                {recoveryReport
                  ? ` · ${recoveryReport.issues.length} issue${recoveryReport.issues.length === 1 ? '' : 's'}`
                  : ''}
              </p>
            </div>
            <button
              onClick={() => setIsRecoveryModalOpen(true)}
              className="settings-action-btn shrink-0"
              data-testid="btn-open-recovery-modal"
            >
              Open
            </button>
          </div>

          {appliedScheduleNotices.length > 0 && (
            <>
              <div className="border-t border-theme-border mt-3 mb-3" />
              <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
                Applied Updates
              </p>
              <div className="space-y-2">
                {appliedScheduleNotices.map((notice) => (
                  <div
                    key={notice.id}
                    className="rounded-theme-small border border-theme-border bg-theme-background px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-theme-text">{notice.title}</p>
                        <p className="text-xs text-theme-muted mt-0.5">{notice.summary}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-theme-primary">
                        {notice.effectiveLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleDismissAppliedScheduleNotices}
                  className="settings-edit-btn"
                >
                  Dismiss
                </button>
              </div>
            </>
          )}
        </Card>

        {/* ── IMPORT / EXPORT ── */}
        <Card title="Import / Export" variant="flat">
          <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
            Privacy
          </p>
          <div className="space-y-1.5 text-xs text-theme-muted">
            <p>
              Your data stays on this device unless you enable sync. Outflow works offline after
              your first visit.
            </p>
            <p>Clearing browser data may remove local history unless you export a backup.</p>
            {settings.lastBackupAt ? (
              <p className="pt-2">
                Last backup: {new Date(settings.lastBackupAt).toLocaleString()}
              </p>
            ) : (
              <p className="pt-2">No backup created yet.</p>
            )}
          </div>
          <div className="border-t border-theme-border mt-4 mb-3" />
          <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
            Export CSV
          </p>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-theme-muted">
              Export your expenses as a CSV file. Compatible with any spreadsheet app (Excel, Google
              Sheets) or budgeting tool.
            </p>
            <button onClick={() => setShowCsvModal(true)} className="settings-action-btn shrink-0">
              Export
            </button>
          </div>
          <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mt-4">
            Import CSV
          </p>
          <div className="flex items-center justify-between py-1">
            <div className="min-w-0">
              <label className="flex items-center gap-2 text-sm text-theme-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={csvImport.replaceMode}
                  onChange={(e) => csvImport.setReplaceMode(e.target.checked)}
                  className="rounded-theme-small"
                />
                Replace mode
              </label>
              <p className="mt-1 text-[11px] leading-5 text-theme-muted">
                CSV replace mode clears your local expenses first, then syncs the new expense set
                back to the cloud in the background. Categories and payees are preserved unless the
                import changes them.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer shrink-0 ml-4">
              <input
                ref={csvImport.fileRef}
                type="file"
                accept=".csv"
                onChange={(e) => csvImport.handleImport(e)}
                className="absolute inset-0 opacity-0 pointer-events-none"
              />
              <span className="settings-action-btn">Choose File</span>
            </label>
          </div>
          <ImportLogPanel importStatus={importStatus} importErrors={importErrors} />
          <div className="border-t border-theme-border mt-4 mb-3" />
          <div className="">
            <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mt-4">
              Export Backup
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-theme-muted">
                Export complete dataset as password-encrypted .ofb file.
              </p>
              <button
                onClick={backup.handleBackupExport}
                data-testid="btn-export-backup"
                className="settings-action-btn shrink-0 ml-4"
              >
                Export
              </button>
            </div>
            <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mt-4">
              Import Backup
            </p>
            <div className="flex items-center justify-between py-1">
              <div className="min-w-0">
                <label className="flex items-center gap-2 text-sm text-theme-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backup.replaceMode}
                    onChange={(e) => backup.setReplaceMode(e.target.checked)}
                    className="rounded-theme-small"
                  />
                  Replace existing data on import
                </label>
                <p className="mt-1 text-[11px] leading-5 text-theme-muted">
                  Replace mode clears the selected data locally first, then rebuilds your cloud
                  backup from this file. Use it when you want the backup to fully overwrite what is
                  in Outflow.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer shrink-0 ml-4">
                <input
                  ref={backup.fileRef}
                  type="file"
                  accept=".ofb,.json"
                  onChange={backup.handleBackupImport}
                  className="absolute inset-0 opacity-0 pointer-events-none"
                />
                <span className="settings-action-btn" data-testid="btn-import-backup">
                  Choose File
                </span>
              </label>
            </div>
          </div>
        </Card>

        {/* ── ABOUT ── */}
        <AboutSection />

        {/* ── ADVANCED ── */}
        <Card title="Advanced" variant="flat" className="card-danger">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
                Clear All Data
              </p>
              <p className="text-xs text-theme-muted">
                Permanently delete all expenses, categories, and settings.
              </p>
            </div>
            <button
              onClick={() => setIsClearModalOpen(true)}
              data-testid="btn-clear-data"
              className="settings-danger-btn shrink-0 ml-4"
            >
              Clear
            </button>
          </div>
        </Card>

        {/* ── MODALS ── */}

        {Boolean(csvImport.pendingImport) && (
          <Suspense
            fallback={
              <LazyModalFallback
                title="Review Import"
                size="xl"
                message="Loading import review…"
                onClose={csvImport.handleCancelReview}
              />
            }
          >
            <ImportReviewModal
              open={Boolean(csvImport.pendingImport)}
              isLoading={Boolean(csvImport.pendingImport?.isLoading)}
              summary={csvImport.pendingImport?.summary ?? null}
              reviewRows={csvImport.pendingImport?.reviewRows ?? []}
              activePayees={csvImport.pendingImport?.activePayees ?? []}
              onBack={csvImport.handleCancelReview}
              onSkipReview={csvImport.handleSkipReview}
              onImport={csvImport.handleFinalizeImport}
            />
          </Suspense>
        )}

        <Modal
          isOpen={backup.showPasswordModal}
          onClose={backup.closePasswordModal}
          title={backup.passwordModalMode === 'export' ? 'Encrypt Backup' : 'Decrypt Backup'}
          size="md"
          footer={
            <ModalFooter>
              <button onClick={backup.closePasswordModal} className="btn-cancel-sm flex-1">
                Cancel
              </button>
              <button onClick={backup.handlePasswordSubmit} className="btn-modal-primary flex-1">
                {backup.passwordModalMode === 'export' ? 'Encrypt & Export' : 'Decrypt & Import'}
              </button>
            </ModalFooter>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-theme-muted">
              {backup.passwordModalMode === 'export'
                ? 'Enter a password to encrypt this backup.'
                : 'Enter the password to decrypt and restore this backup.'}
            </p>
            <label className="flex flex-col gap-1 text-xs text-theme-muted">
              Password
              <input
                type="password"
                value={backup.backupPassword}
                onChange={(e) => backup.setBackupPassword(e.target.value)}
                placeholder="Enter password"
                className="input-theme px-3 py-2 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') backup.handlePasswordSubmit()
                }}
              />
            </label>
            {backup.passwordModalMode === 'export' && user?.id && (
              <label className="flex items-center gap-2 text-xs text-theme-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={backup.rememberBackupPassword}
                  onChange={(e) => backup.setRememberBackupPassword(e.target.checked)}
                  className="rounded-theme-small"
                />
                Remember for future backups
              </label>
            )}
            {backup.passwordError && (
              <p className="text-xs text-theme-danger">{backup.passwordError}</p>
            )}
          </div>
        </Modal>

        <ConfirmDialog
          isOpen={backup.showDbVersionModal}
          onClose={backup.closeDbVersionModal}
          title="Backup Version Mismatch"
          description={
            <div className="space-y-3">
              <p className="text-xs text-theme-danger">
                This backup was made with a newer app version. Some data may not import correctly.
              </p>
              {backup.pendingImportMeta && (
                <div className="text-xs text-theme-muted space-y-1">
                  <p>
                    <span className="font-medium">Exported:</span>{' '}
                    {backup.pendingImportMeta.exportedAt
                      ? new Date(backup.pendingImportMeta.exportedAt as string).toLocaleString()
                      : 'Unknown'}
                  </p>
                  <p>
                    <span className="font-medium">Backup DB version:</span>{' '}
                    {String(backup.pendingImportMeta.dbVersion ?? '?')}
                  </p>
                  <p>
                    <span className="font-medium">Current DB version:</span> {dbVersion()}
                  </p>
                </div>
              )}
            </div>
          }
          confirmLabel="Proceed Anyway"
          confirmVariant="destructive"
          onConfirm={backup.handleDbVersionProceed}
        />

        <Modal
          isOpen={isRecoveryModalOpen}
          onClose={() => setIsRecoveryModalOpen(false)}
          title="Data Recovery"
          size="md"
          footer={
            <ModalFooter>
              <button
                onClick={() => setIsRecoveryModalOpen(false)}
                className="btn-cancel-sm flex-1"
              >
                Close
              </button>
              <button
                onClick={() => void handleRunRecoveryCheck()}
                className="settings-action-btn relative flex-1"
                disabled={isRunningRecoveryCheck}
                aria-busy={isRunningRecoveryCheck}
                data-testid="btn-run-diagnostics"
              >
                <span>Run diagnostics</span>
              </button>
              <button
                onClick={() => {
                  setIsRecoveryModalOpen(false)
                  setIsRebuildCloudModalOpen(true)
                }}
                className="btn-modal-destructive flex-1"
                disabled={
                  !user?.id ||
                  recoveryStatus === 'local_repair_required' ||
                  recoveryStatus === 'recovering' ||
                  isRebuildingCloud
                }
                data-testid="btn-rebuild-cloud-local"
              >
                Rebuild cloud
              </button>
            </ModalFooter>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-theme-muted">
              Outflow stores your data locally first. Cloud sync is a replica of your local data.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2">
                <p className="text-theme-muted">Status</p>
                <p className="mt-1 font-semibold text-theme-text">{recoveryStatus}</p>
              </div>
              <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2">
                <p className="text-theme-muted">Issues</p>
                <p className="mt-1 font-semibold text-theme-text">
                  {recoveryReport?.issues.length ?? 0}
                </p>
              </div>
              <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2">
                <p className="text-theme-muted">Local Expenses</p>
                <p className="mt-1 font-semibold text-theme-text">
                  {recoveryReport?.localCounts.expenses ?? '—'}
                </p>
              </div>
              <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2">
                <p className="text-theme-muted">Cloud Expenses</p>
                <p className="mt-1 font-semibold text-theme-text">
                  {recoveryReport?.cloudCounts?.expenses ?? '—'}
                </p>
              </div>
            </div>
            {recoveryReport?.issues.length ? (
              <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2">
                <p className="text-xs font-semibold text-theme-text">Issues</p>
                <div className="mt-2 space-y-1">
                  {recoveryReport.issues.map((issue) => (
                    <p key={issue} className="text-xs text-theme-muted">
                      {issue}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            {recoveryStatus === 'local_repair_required' && (
              <p className="text-xs text-theme-danger">
                Local data needs repair first. Restore a local backup, then rebuild cloud from
                local.
              </p>
            )}
          </div>
        </Modal>

        <Modal
          isOpen={isRebuildCloudModalOpen}
          onClose={() => setIsRebuildCloudModalOpen(false)}
          title="Rebuild Cloud From Local"
          size="sm"
          footer={
            <ModalFooter>
              <button
                onClick={() => setIsRebuildCloudModalOpen(false)}
                className="btn-cancel-sm flex-1"
                disabled={isRebuildingCloud}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsRebuildingCloud(true)
                  try {
                    await rebuildCloudFromLocal()
                    setIsRebuildCloudModalOpen(false)
                    showToast({ message: 'Cloud rebuilt from local data.', tone: 'success' })
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error'
                    showToast({ message: `Rebuild failed: ${message}`, tone: 'danger' })
                  } finally {
                    setIsRebuildingCloud(false)
                  }
                }}
                className="btn-modal-destructive flex-1"
                disabled={isRebuildingCloud}
              >
                Rebuild Cloud
              </button>
            </ModalFooter>
          }
        >
          <p className="text-xs text-theme-muted">
            This will replace your cloud data with the current local data. Local data will not be
            deleted.
          </p>
        </Modal>

        <Modal
          isOpen={isClearModalOpen}
          onClose={() => {
            setIsClearModalOpen(false)
            setDeleteConfirm('')
          }}
          title="Clear All Data"
          size="sm"
          footer={
            <ModalFooter>
              <button
                onClick={() => {
                  setIsClearModalOpen(false)
                  setDeleteConfirm('')
                }}
                className="btn-cancel-sm flex-1"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirm !== 'DELETE') return
                  await handleClearAll()
                  setIsClearModalOpen(false)
                  setDeleteConfirm('')
                  triggerClearReload()
                }}
                disabled={deleteConfirm !== 'DELETE'}
                className="btn-modal-destructive flex-1 disabled:opacity-40"
              >
                Clear Everything
              </button>
            </ModalFooter>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-theme-muted">
              This will permanently delete everything. This cannot be undone.
            </p>
            <label className="flex flex-col gap-1 text-xs text-theme-muted">
              Type <span className="font-mono text-theme-danger">DELETE</span> to confirm
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="input-theme px-3 py-2 text-sm"
                autoFocus
              />
            </label>
          </div>
        </Modal>

        <LoadingOverlay
          isOpen={backup.isReloading || isClearReloading}
          message="Processing…"
          subMessage="Refreshing app…"
        />

        {/* ── CSV Export Modal ── */}
        <Modal
          isOpen={showCsvModal}
          onClose={handleCloseCsvModal}
          title="Export CSV"
          size="sm"
          footer={
            <ModalFooter>
              <button onClick={handleCloseCsvModal} className="btn-cancel-sm flex-1">
                Cancel
              </button>
              <button onClick={handleCsvExport} className="btn-modal-primary flex-1">
                Download
              </button>
            </ModalFooter>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-xs text-theme-muted">
              Select a date range to filter the export. Leave blank to include all expenses.
            </p>
            <label className="flex flex-col gap-1 text-xs text-theme-muted">
              From
              <DatePicker
                value={exportRange.from}
                onChange={(iso) => setExportRange((r) => ({ ...r, from: iso }))}
                variant="inline"
                inputStyle="default"
                placeholder="From"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-theme-muted">
              To
              <DatePicker
                value={exportRange.to}
                onChange={(iso) => setExportRange((r) => ({ ...r, to: iso }))}
                variant="inline"
                inputStyle="default"
                placeholder="To"
              />
            </label>
          </div>
        </Modal>

        {isHistoricalDataModalOpen && (
          <Suspense
            fallback={
              <LazyModalFallback
                title="Edit Historical Data"
                size="full"
                message="Loading historical editor…"
                onClose={() => setIsHistoricalDataModalOpen(false)}
              />
            }
          >
            <EditHistoricalDataModal
              isOpen={isHistoricalDataModalOpen}
              onClose={() => setIsHistoricalDataModalOpen(false)}
              years={availableYears}
              expenses={expenses}
              defaultIncome={monthlyIncome}
              defaultSavingsRate={savingsRate}
              onComplete={() => {
                setEditHistoricalDataYears([])
                setShowHistoricalCompletionPrompt(false)
                onRefreshAll?.()
                void (syncLocalThenPull ?? syncNow)?.()
              }}
            />
          </Suspense>
        )}

        <Modal
          isOpen={showHistoricalCompletionPrompt && editHistoricalDataYears.length > 0}
          onClose={dismissHistoricalCompletionPrompt}
          title="Complete Imported Months"
          size="md"
          footer={
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={dismissHistoricalCompletionPrompt}
                className="btn-cancel-sm flex-1"
              >
                Later
              </button>
              <button
                type="button"
                onClick={reviewHistoricalData}
                className="btn-modal-primary flex-1"
              >
                Review Historical Data
              </button>
            </div>
          }
        >
          <p className="text-sm text-theme-muted">
            Your transactions were imported successfully. Add income, fixed expenses, and savings
            rate for {`${editHistoricalDataYears.join(', ')} `} to make summaries and analytics
            accurate.
          </p>
        </Modal>

        {isScheduleModalOpen && (
          <Suspense
            fallback={
              <LazyModalFallback
                title={scheduleToEdit ? 'Edit Schedule' : 'Add Schedule'}
                message="Loading schedule editor…"
                onClose={handleScheduleModalClose}
              />
            }
          >
            <ScheduleModal
              isOpen={isScheduleModalOpen}
              onClose={handleScheduleModalClose}
              editSchedule={scheduleToEdit}
              onComplete={() => {
                loadSchedules()
                onRefreshAll?.()
                queueLocalSync()
              }}
            />
          </Suspense>
        )}
      </div>
    </main>
  )
}
