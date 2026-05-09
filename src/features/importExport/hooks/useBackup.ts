import type { User } from '@supabase/supabase-js'
import { useCallback, useRef, useState } from 'react'
import { useSettings } from '../../../context/settingsContext'
import { StorageService } from '../../../services/storageService'
import {
  fetchBackupPasswordFromProfile,
  syncBackupPasswordToProfile,
} from '../../../services/syncService'
import { APP_VERSION } from '../../../utils/appVersion'
import { decryptBackup, encryptBackup, isEncryptedEnvelope } from '../../../utils/backupCrypto'
import { getLocalToday } from '../../../utils/historicalDataHelpers'

interface UseBackupParams {
  user: User | null
  onStatus: (s: string) => void
  onRefreshAll?: () => Promise<void> | void
  triggerSync?: () => void
}

export function useBackup({ user, onStatus, onRefreshAll, triggerSync }: UseBackupParams) {
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

  const triggerReload = useCallback(() => {
    setIsReloading(true)
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }, [])

  const doExport = useCallback(async (password: string) => {
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
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
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
  }, [user, onStatus, save])

  const handleBackupExport = useCallback(async () => {
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
  }, [user, doExport])

  const handlePasswordSubmit = useCallback(async () => {
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
  }, [
    backupPassword,
    passwordModalMode,
    user,
    rememberBackupPassword,
    pendingFile,
    replaceMode,
    onRefreshAll,
    triggerSync,
    triggerReload,
    doExport,
  ])

  const handleBackupImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      } catch (err) {
        console.error('Import failed:', err)
        onStatus(`Import failed: ${(err as Error).message}`)
      }
      if (fileRef.current) fileRef.current.value = ''
    },
    [replaceMode, onRefreshAll, triggerSync, triggerReload, onStatus],
  )

  const closePasswordModal = useCallback(() => {
    setShowPasswordModal(false)
    setPasswordError('')
    setPendingFile(null)
  }, [])

  const closeDbVersionModal = useCallback(() => {
    setShowDbVersionModal(false)
    setPendingImportPayload(null)
    setPendingImportMeta(null)
  }, [])

  const handleDbVersionProceed = useCallback(async () => {
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
  }, [pendingImportPayload, replaceMode, onRefreshAll, triggerSync, triggerReload, onStatus])

  return {
    fileRef,
    replaceMode,
    setReplaceMode,
    handleBackupExport,
    handleBackupImport,
    showPasswordModal,
    passwordModalMode,
    backupPassword,
    setBackupPassword,
    rememberBackupPassword,
    setRememberBackupPassword,
    passwordError,
    handlePasswordSubmit,
    closePasswordModal,
    showDbVersionModal,
    pendingImportMeta,
    handleDbVersionProceed,
    closeDbVersionModal,
    isReloading,
  }
}
