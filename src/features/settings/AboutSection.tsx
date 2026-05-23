import { useCallback } from 'react'
import Card from '../../components/ui/Card'
import { useSettings } from '../../context/settingsContext'
import { useToasts } from '../../context/toastContext'
import {
  appVersion,
  shortBuildSha,
  appBuildDate,
  appEnvironment,
  getAppDiagnostics,
} from '../../lib/appMetadata'

export default function AboutSection() {
  const { showToast } = useToasts()
  const { formatDate } = useSettings()

  const handleCopy = useCallback(() => {
    const diagnostics = getAppDiagnostics()
    const text = Object.entries(diagnostics)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    navigator.clipboard.writeText(`Outflow diagnostics\n${text}`).then(
      () => showToast({ message: 'Diagnostics copied', tone: 'success', durationMs: 2500 }),
      () => showToast({ message: 'Failed to copy', tone: 'danger', durationMs: 2500 }),
    )
  }, [showToast])

  const envLabel = appEnvironment === 'local' ? 'local' : appEnvironment.toUpperCase()
  const builtAt = appBuildDate ? new Date(appBuildDate) : null
  const builtDateLabel =
    builtAt && Number.isFinite(builtAt.getTime())
      ? `${formatDate(builtAt.toISOString().slice(0, 10))} ${builtAt.toISOString().slice(11, 16)}`
      : appBuildDate

  return (
    <Card
      title="About"
      variant="flat"
      actions={
        <button type="button" onClick={handleCopy} className="settings-edit-btn">
          Copy diagnostics
        </button>
      }
    >
      <p className="pb-2 text-xs font-semibold text-theme-muted uppercase tracking-wider">
        Build details
      </p>
      <div className="space-y-1 text-xs text-theme-muted">
        <div className="flex items-center justify-between">
          <span>Version</span>
          <span className="text-theme-text font-medium">{appVersion}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Build</span>
          <span className="text-theme-text font-medium">{shortBuildSha}</span>
        </div>
        {builtDateLabel && (
          <div className="flex items-center justify-between">
            <span>Built</span>
            <span className="text-theme-text font-medium">{builtDateLabel}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span>Environment</span>
          <span className="text-theme-text font-medium">{envLabel}</span>
        </div>
      </div>
    </Card>
  )
}
