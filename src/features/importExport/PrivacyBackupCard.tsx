import Card from '../../components/ui/Card'
import { useSettings } from '../../context/settingsContext'

interface PrivacyBackupCardProps {
  variant?: 'default' | 'flat'
}

export default function PrivacyBackupCard({ variant = 'default' }: PrivacyBackupCardProps) {
  const { settings } = useSettings()

  const lastBackup =
    settings.lastBackupAt != null ? new Date(settings.lastBackupAt).toLocaleString() : null

  return (
    <Card title="Privacy & backups" variant={variant}>
      <div className="space-y-2 text-xs text-theme-muted">
        <p>Your data stays on this device unless you enable sync.</p>
        <p>
          Outflow works offline after your first visit. Your spending history is stored in this
          browser or device.
        </p>
        <p>
          Installable does not mean backed up. Export a backup anytime from Settings to protect your
          history.
        </p>
        <p>Clearing browser data may remove local history unless you export a backup.</p>
        <p>{lastBackup ? `Last backup: ${lastBackup}` : 'No backup created yet.'}</p>
      </div>
    </Card>
  )
}
