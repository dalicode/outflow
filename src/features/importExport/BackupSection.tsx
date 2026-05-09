import type { User } from '@supabase/supabase-js'
import { useRef, useState } from 'react'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingOverlay from '../../components/ui/LoadingOverlay'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import { useSettings } from '../../context/settingsContext'
import { StorageService } from '../../services/storageService'
import {
  fetchBackupPasswordFromProfile,
  syncBackupPasswordToProfile,
} from '../../services/syncService'
import { APP_VERSION } from '../../utils/appVersion'
import { decryptBackup, encryptBackup, isEncryptedEnvelope } from '../../utils/backupCrypto'
import { getLocalToday } from '../../utils/historicalDataHelpers'

interface BackupSectionProps {
  user: User | null
  onStatus: (status: string) => void
  onRefreshAll?: () => Promise<void> | void
  triggerSync?: () => void
  variant?: 'default' | 'flat'
}

export default function BackupSection({
  user,
  onStatus,
  onRefreshAll,
  triggerSync,
  variant = 'default',
}: BackupSectionProps) {
  const { save } = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [replaceMode, setReplaceMode] = useState(false)

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordModalMode, setPasswordModalMode] = useState<'export' | 'import'>('export')
  const [backupPassword, setBackupPassword] = useState('')
  const [rememberBackupPassword, setRememberBackupPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [showDbVersionModal, setShowDbVersionModal] = useState(false)
  const [pendingImportPayload, setPendingImportPayload] = useState<Record<string, unknown> | null>(
    null,
  )
  const [pendingImportMeta, setPendingImportMeta] = useState<Record<string, unknown> | null>(null)
  const [isReloading, setIsReloading] = useState(false)

  const triggerReload = () => {
    setIsReloading(true)
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  const doExport = async (password: string) => {
    try {
      onStatus('Exporting encrypted backup…')
      const data = await StorageService.exportAllData()
      const dbVersion = StorageService.dbVersion()
      const recordCounts: Record<string, number> = {}
      for (const [key, arr] of Object.entries(data)) {
        recordCounts[key] = Array.isArray(arr) ? arr.length : 0
      }
      const payload = {
        meta: {
          exportedAt: new Date().toISOString(),
          appVersion: APP_VERSION,
          dbVersion,
          format: 'outflow-backup',
          recordCounts,
          userEmail: user?.email ?? null,
        },
        data,
      }
      const envelope = await encryptBackup(payload, password)
      const blob = new Blob([JSON.stringify(envelope, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `outflow-backup-${getLocalToday()}.ofb`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      void save({ lastBackupAt: new Date().toISOString() }).catch((error) =>
        console.warn('Backup timestamp save failed:', error),
      )
      onStatus('Encrypted backup exported successfully.')
    } catch (err) {
      console.error('Export failed:', err)
      onStatus(`Export failed: ${(err as Error).message}`)
    }
  }

  const handleBackupExport = async () => {
    if (user?.id) {
      const saved = await fetchBackupPasswordFromProfile(user.id)
      if (saved) {
        await doExport(saved)
        return
      }
    }
    setPasswordModalMode('export')
    setBackupPassword('')
    setRememberBackupPassword(false)
    setPasswordError('')
    setShowPasswordModal(true)
  }

  const handlePasswordSubmit = async () => {
    setPasswordError('')
    if (!backupPassword) {
      setPasswordError('Password is required.')
      return
    }
    if (passwordModalMode === 'export') {
      if (user?.id && rememberBackupPassword) {
        await syncBackupPasswordToProfile(user.id, backupPassword)
      }
      setShowPasswordModal(false)
      await doExport(backupPassword)
    } else {
      if (!pendingFile) return
      try {
        const text = await pendingFile.text()
        const parsed = JSON.parse(text)
        const decrypted = isEncryptedEnvelope(parsed)
          ? await decryptBackup(parsed, backupPassword)
          : parsed
        if (
          typeof decrypted === 'object' &&
          decrypted !== null &&
          'meta' in decrypted &&
          typeof (decrypted as Record<string, unknown>).meta === 'object'
        ) {
          const meta = (decrypted as Record<string, unknown>).meta as Record<string, unknown>
          const currentDbVersion = StorageService.dbVersion()
          const backupDbVersion = typeof meta.dbVersion === 'number' ? meta.dbVersion : 0
          if (backupDbVersion > currentDbVersion) {
            setPendingImportPayload(decrypted as Record<string, unknown>)
            setPendingImportMeta(meta)
            setShowDbVersionModal(true)
            setShowPasswordModal(false)
            setPendingFile(null)
            return
          }
        }
        await StorageService.importAllData(decrypted as Record<string, unknown>, {
          replace: replaceMode,
        })
        await onRefreshAll?.()
        triggerSync?.()
        setShowPasswordModal(false)
        setPendingFile(null)
        triggerReload()
      } catch (err) {
        setPasswordError((err as Error).message)
        return
      }
    }
  }

  const handleBackupImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const file = e.target.files?.[0]
    if (!file) return
    onStatus('Reading backup…')
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        onStatus('Invalid backup file.')
        if (fileRef.current) fileRef.current.value = ''
        return
      }

      if (!parsed || typeof parsed !== 'object') {
        onStatus('Invalid data: must be an object.')
        if (fileRef.current) fileRef.current.value = ''
        return
      }

      if (isEncryptedEnvelope(parsed)) {
        setPendingFile(file)
        setPasswordModalMode('import')
        setBackupPassword('')
        setPasswordError('')
        setShowPasswordModal(true)
        if (fileRef.current) fileRef.current.value = ''
        return
      }

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'meta' in parsed &&
        typeof (parsed as Record<string, unknown>).meta === 'object'
      ) {
        const meta = (parsed as Record<string, unknown>).meta as Record<string, unknown>
        const currentDbVersion = StorageService.dbVersion()
        const backupDbVersion = typeof meta.dbVersion === 'number' ? meta.dbVersion : 0
        if (backupDbVersion > currentDbVersion) {
          setPendingImportPayload(parsed as Record<string, unknown>)
          setPendingImportMeta(meta)
          setShowDbVersionModal(true)
          if (fileRef.current) fileRef.current.value = ''
          return
        }
      }

      const knownKeys = [
        'expenses',
        'categories',
        'fixedExpenses',
        'fixedExpenseSnapshots',
        'settings',
        'syncQueue',
      ]
      const payload =
        typeof parsed === 'object' && parsed !== null && 'data' in parsed
          ? ((parsed as Record<string, unknown>).data as Record<string, unknown>)
          : (parsed as Record<string, unknown>)
      const hasKnownKey = knownKeys.some((k) => k in payload)
      if (!hasKnownKey) {
        onStatus('Invalid backup: must include at least one known data key.')
        if (fileRef.current) fileRef.current.value = ''
        return
      }

      await StorageService.importAllData(parsed as Record<string, unknown>, {
        replace: replaceMode,
      })
      await onRefreshAll?.()
      triggerSync?.()
      triggerReload()
      return
    } catch (err) {
      console.error('Import failed:', err)
      onStatus(`Import failed: ${(err as Error).message}`)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3">
        <Card title="Export Backup" className="flex-1" variant={variant}>
          <p className="text-xs text-theme-muted mb-2">
            Export your complete dataset as a password-encrypted .ofb backup file. Your data stays
            local unless you enable sync.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleBackupExport}
              data-testid="btn-export-backup"
              className="settings-action-btn"
            >
              Export Backup
            </button>
          </div>
        </Card>

        <Card title="Import Backup" className="flex-1" variant={variant}>
          <p className="text-xs text-theme-muted mb-2">
            Restore from an encrypted .ofb backup or a legacy plain JSON file. You can review
            version details before proceeding.
          </p>
          <label className="flex items-center gap-1.5 text-xs text-theme-text mb-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={replaceMode}
              onChange={(e) => setReplaceMode(e.target.checked)}
              className="rounded-theme-small"
            />
            Replace existing data
          </label>
          <label className="relative inline-flex cursor-pointer shrink-0">
            <input
              ref={fileRef}
              type="file"
              accept=".ofb,.json"
              onChange={handleBackupImport}
              className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
            />
            <span className="settings-action-btn shrink-0" data-testid="btn-import-backup">
              Choose File
            </span>
          </label>
        </Card>
      </div>

      {/* Backup Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false)
          setPasswordError('')
          setPendingFile(null)
        }}
        title={passwordModalMode === 'export' ? 'Encrypt Backup' : 'Decrypt Backup'}
        size="md"
        footer={
          <ModalFooter>
            <button
              onClick={() => {
                setShowPasswordModal(false)
                setPasswordError('')
                setPendingFile(null)
              }}
              className="btn-cancel-sm flex-1"
            >
              Cancel
            </button>
            <button onClick={handlePasswordSubmit} className="btn-modal-primary flex-1">
              {passwordModalMode === 'export' ? 'Encrypt & Export' : 'Decrypt & Import'}
            </button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-theme-muted">
            {passwordModalMode === 'export'
              ? 'Enter a password to encrypt this backup. You will need this same password to restore it later.'
              : 'This backup is password-protected. Enter the password to decrypt and restore it.'}
          </p>
          <label className="flex flex-col gap-1 text-xs text-theme-muted">
            Password
            <input
              type="password"
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              placeholder="Enter password"
              className="input-theme px-3 py-2 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePasswordSubmit()
              }}
            />
          </label>
          {passwordModalMode === 'export' && user?.id && (
            <label className="flex items-center gap-1.5 text-xs text-theme-text cursor-pointer">
              <input
                type="checkbox"
                checked={rememberBackupPassword}
                onChange={(e) => setRememberBackupPassword(e.target.checked)}
                className="rounded-theme-small"
              />
              Remember for future backups
            </label>
          )}
          {passwordError && <p className="text-xs text-theme-danger">{passwordError}</p>}
        </div>
      </Modal>

      {/* DB Version Warning Modal */}
      <ConfirmDialog
        isOpen={showDbVersionModal}
        onClose={() => {
          setShowDbVersionModal(false)
          setPendingImportPayload(null)
          setPendingImportMeta(null)
        }}
        title="Backup Version Mismatch"
        description={
          <div className="space-y-3">
            <p className="text-xs text-theme-danger">
              This backup was made with a newer app version. Some data may not import correctly.
            </p>
            {pendingImportMeta && (
              <div className="text-xs text-theme-muted space-y-1">
                <p>
                  <span className="font-medium">Exported:</span>{' '}
                  {pendingImportMeta.exportedAt
                    ? new Date(pendingImportMeta.exportedAt as string).toLocaleString()
                    : 'Unknown'}
                </p>
                <p>
                  <span className="font-medium">Backup DB version:</span>{' '}
                  {String(pendingImportMeta.dbVersion ?? '?')}
                </p>
                <p>
                  <span className="font-medium">Current DB version:</span>{' '}
                  {StorageService.dbVersion()}
                </p>
                {pendingImportMeta && (pendingImportMeta.recordCounts as Record<string, number> | undefined) && (
                  <p>
                    <span className="font-medium">Records:</span>{' '}
                    {Object.entries(
                      pendingImportMeta.recordCounts as Record<string, number>,
                    )
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        }
        confirmLabel="Proceed Anyway"
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!pendingImportPayload) return
          try {
            await StorageService.importAllData(pendingImportPayload, {
              replace: replaceMode,
            })
            await onRefreshAll?.()
            triggerSync?.()
            setShowDbVersionModal(false)
            setPendingImportPayload(null)
            setPendingImportMeta(null)
            triggerReload()
          } catch (err) {
            onStatus(`Import failed: ${(err as Error).message}`)
            setShowDbVersionModal(false)
            setPendingImportPayload(null)
            setPendingImportMeta(null)
          }
        }}
      />

      <LoadingOverlay
        isOpen={isReloading}
        message="Loaded successfully"
        subMessage="Refreshing app…"
      />
    </>
  )
}
