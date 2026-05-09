import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/authContext'
import { SettingsProvider } from './context/settingsContext'
import { applyDisplayModeClasses } from './utils/displayModeClasses'
import './index.css'

const errorDiv = document.getElementById('boot-error')
const showError = (msg: string) => {
  if (errorDiv) {
    errorDiv.style.display = 'block'
    errorDiv.textContent = msg
  }
}

try {
  applyDisplayModeClasses()
  const root = document.getElementById('root')
  if (!root) {
    showError('Fatal: #root not found')
  } else {
    ReactDOM.createRoot(root).render(
      <AuthProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </AuthProvider>,
    )
  }
} catch (e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e))
  showError(`Fatal render error: ${err.message}\n${err.stack}`)
}
