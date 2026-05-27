import type { ReactNode } from 'react'
import { AuthProvider } from '../context/authContext'
import { FinanceDataProvider } from '../context/financeDataContext'
import { SettingsProvider } from '../context/settingsContext'
import { ToastProvider } from '../context/toastContext'

interface AppProvidersProps {
  children: ReactNode
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <FinanceDataProvider>{children}</FinanceDataProvider>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
