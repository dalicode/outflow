import { useCallback } from 'react'
import Card from '../../components/ui/Card'
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

  const envLabel = appEnvironment === 'local' ? 'Local' : appEnvironment.toUpperCase()

  return (
    <Card title="About" variant="flat">
      <div className="space-y-1.5 text-xs text-theme-muted font-mono">
        <div className="flex items-center justify-between">
          <span>Version</span>
          <span className="text-theme-text">{appVersion}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Build</span>
          <span className="text-theme-text">{shortBuildSha}</span>
        </div>
        {appBuildDate && (
          <div className="flex items-center justify-between">
            <span>Built</span>
            <span className="text-theme-text">{appBuildDate.replace('T', ' ').slice(0, 16)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span>Environment</span>
          <span className="text-theme-text">{envLabel}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 text-xs text-theme-muted hover:text-theme-text transition-colors"
      >
        Copy diagnostics
      </button>
    </Card>
  )
}
