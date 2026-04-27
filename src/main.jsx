import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './context/authContext'
import { SettingsProvider } from './context/settingsContext'
import App from './App'
import './index.css'

const errorDiv = document.getElementById('boot-error')
function showError(msg) {
  if (errorDiv) { errorDiv.style.display = 'block'; errorDiv.textContent = msg; }
}

try {
  const root = document.getElementById('root')
  if (!root) { showError('Fatal: #root not found'); }
  else {
    ReactDOM.createRoot(root).render(
      <AuthProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </AuthProvider>
    )
  }
} catch (e) {
  showError('Fatal render error: ' + e.message + '\n' + e.stack)
}
