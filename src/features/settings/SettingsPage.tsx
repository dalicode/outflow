import { useCallback, useEffect, useMemo, useState } from 'react'
import './settings.css'
import DatePicker from '../../components/inputs/DatePicker'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingOverlay from '../../components/ui/LoadingOverlay'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import { useAuth } from '../../context/authContext'
import { useSettings } from '../../context/settingsContext'
import { useToasts } from '../../context/toastContext'
import { usePayees } from '../../hooks/useLocalData'
import { useScheduleList } from './hooks/useScheduleList'
import { StorageService } from '../../services/storageService'
import { clearUserCloudData } from '../../services/syncService'
import type { Category, Expense, Schedule, ScheduleMaterializationNotice } from '../../types'
import { getLocalToday } from '../../utils/historicalDataHelpers'
import { useBackup } from '../importExport/hooks/useBackup'
import { useCsvImport } from '../importExport/hooks/useCsvImport'
import ImportLogPanel from '../importExport/ImportLogPanel'
import ImportReviewModal from '../importExport/ImportReviewModal'
import { downloadCSV, expenseToRow } from '../importExport/utils/csvHelpers'
import EditHistoricalDataModal from './EditHistoricalDataModal'
import ScheduleList from './ScheduleList'
import ScheduleModal from './ScheduleModal'
import ThemeSelector from './ThemeSelector'
import AboutSection from './AboutSection'

interface RowProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: [string, string][]
}

function Row({ label, value, onChange, options }: RowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-theme-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-theme px-2.5 py-1 text-sm cursor-pointer"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  )
}

interface SettingsPageProps {
  expenses: Expense[]
  onImport?: () => Promise<void> | void
  onRefreshAll?: () => Promise<void> | void
  triggerSync?: () => void
  syncNow?: () => Promise<void>
  showSignIn?: boolean
  onSignIn?: () => void
}

export default function SettingsPage({
  expenses,
  onRefreshAll,
  triggerSync,
  syncNow,
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

  const { schedules, loadSchedules, deleteSchedule } = useScheduleList()
  const backup = useBackup({
    user,
    onStatus: setImportStatus,
    onRefreshAll,
    triggerSync,
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
    triggerSync,
  })

  useEffect(() => {
    StorageService.getCategories().then(setCategories)
  }, [])
  useEffect(() => {
    StorageService.getSetting<ScheduleMaterializationNotice[]>(
      'scheduleMaterializationLog',
      [],
    ).then((log) => {
      setAppliedScheduleNotices(Array.isArray(log) ? log : [])
    })
  }, [])
  useEffect(() => {
    Promise.all([
      StorageService.getSetting('monthlyIncome', 0),
      StorageService.getSetting('savingsRate', 0),
    ]).then(([income, rate]) => {
      setMonthlyIncome(String((income as number | null) ?? ''))
      setSavingsRate(String((rate as number | null) ?? ''))
    })
  }, [])
  useEffect(() => {
    StorageService.getCategories().then(setCsvCategories)
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
    await StorageService.setSetting('scheduleMaterializationLog', [])
    setAppliedScheduleNotices([])
  }

  const handleClearAll = async () => {
    try {
      if (user?.id) {
        await clearUserCloudData(user.id)
      }
      await StorageService.clearAllData()
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
        <Card title="Appearance">
          <ThemeSelector value={settings.visualTheme} onChange={(v) => save({ visualTheme: v })} />
          <div className="flex items-center gap-2 text-xs text-theme-muted mt-2">
            <span className="inline-block w-2 h-2 rounded-full bg-theme-success" />
            Active: <span className="font-medium text-theme-text">{currentTheme.name}</span>
          </div>

          <div className="border-t border-theme-border mt-4 mb-3" />
          <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
            Display
          </p>

          <Row
            label="Font"
            value={settings.font}
            onChange={(v) => save({ font: v })}
            options={[
              ['system', 'System UI'],
              ['sans', 'Sans-serif'],
              ['serif', 'Serif'],
              ['mono', 'Monospace'],
              ['roboto', 'Roboto'],
              ['georgia', 'Georgia'],
              ['financeMono', 'Data Mono'],
            ]}
          />
          <Row
            label="Font size"
            value={settings.fontSize}
            onChange={(v) => save({ fontSize: v })}
            options={[
              ['0.85', 'Small'],
              ['1', 'Medium'],
              ['1.15', 'Large'],
              ['1.3', 'X-Large'],
            ]}
          />
          <Row
            label="Currency"
            value={settings.currencySymbol}
            onChange={(v) => save({ currencySymbol: v })}
            options={[
              ['$', '$ Dollar'],
              ['€', '€ Euro'],
              ['£', '£ Pound'],
              ['¥', '¥ Yen'],
              ['₹', '₹ Rupee'],
            ]}
          />
          <Row
            label="Decimals"
            value={settings.decimalPlaces}
            onChange={(v) => save({ decimalPlaces: v })}
            options={[
              ['0', '0'],
              ['1', '1'],
              ['2', '2'],
            ]}
          />
          <Row
            label="Separator"
            value={settings.thousandSep}
            onChange={(v) => save({ thousandSep: v })}
            options={[
              [',', '1,000'],
              ['.', '1.000'],
              [' ', '1 000'],
            ]}
          />
          <Row
            label="Date format"
            value={settings.dateFormat}
            onChange={(v) => save({ dateFormat: v })}
            options={[
              ['MM/DD/YYYY', 'MM/DD/YYYY'],
              ['DD/MM/YYYY', 'DD/MM/YYYY'],
              ['YYYY-MM-DD', 'YYYY-MM-DD'],
            ]}
          />
          <p className="text-xs text-theme-muted mt-2">
            Preview: {formatAmount(1234567.89)} · {formatDate(getLocalToday())}
          </p>
        </Card>

        {/* ── PREFERENCES ── */}
        <Card title="Preferences">
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
              onClick={() => save({ hapticsEnabled: !settings.hapticsEnabled })}
              className="settings-toggle"
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>
        </Card>

        {/* ── ACCOUNT ── */}
        <Card title="Account">
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
                onClick={async () => {
                  const { error } = await signOut()
                  if (error) showToast({ message: error.message, tone: 'danger' })
                }}
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

        {/* ── DATA ── */}
        <Card title="Data">
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
            onDelete={deleteSchedule}
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
                {recoveryReport ? ` · ${recoveryReport.issues.length} issue${recoveryReport.issues.length === 1 ? '' : 's'}` : ''}
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
        <Card title="Import / Export">
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
        <Card title="Advanced" className="border border-theme-danger-subtle">
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
                    <span className="font-medium">Current DB version:</span>{' '}
                    {StorageService.dbVersion()}
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
              <button onClick={() => setIsRecoveryModalOpen(false)} className="btn-cancel-sm flex-1">
                Close
              </button>
              <button
                onClick={() => void runRecoveryCheck()}
                className="settings-action-btn flex-1"
                data-testid="btn-run-diagnostics"
              >
                Run diagnostics
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
            void syncNow?.()
          }}
        />

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

        <ScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={handleScheduleModalClose}
          editSchedule={scheduleToEdit}
          onComplete={() => {
            loadSchedules()
            onRefreshAll?.()
          }}
        />
      </div>
    </main>
  )
}
