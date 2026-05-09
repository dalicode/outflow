import { useState } from 'react'
import { supabase } from '../../services/supabase'
import './auth.css'

type AuthMode = 'login' | 'signup'

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.SubmitEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    if (!supabase) {
      setError('Authentication service is not available.')
      setLoading(false)
      return
    }
    const fn =
      mode === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })
    const { error: err } = await fn
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    if (mode === 'signup') setMessage('Check your email to confirm your account.')
  }

  const signInWithGoogle = () =>
    supabase?.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

  return (
    <div className="min-h-dvh bg-theme-background flex items-center justify-center px-4">
      <div className="modal-theme p-8 w-full max-w-sm space-y-5 shadow-xl">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <div className="relative flex items-center">
              <img src="/icon.svg" alt="" className="w-7 h-7 shrink-0 absolute right-full mr-2" />
              <span className="text-lg font-bold text-theme-primary tracking-tight">Outflow</span>
            </div>
          </div>
          <p className="text-sm text-theme-muted">
            {mode === 'login' ? 'Sign in to sync your data' : 'Create an account'}
          </p>
        </div>

        {error && <p className="text-theme-danger text-sm text-center">{error}</p>}
        {message && <p className="text-theme-success text-sm text-center">{message}</p>}

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoFocus
            className="input-md w-full"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="input-md w-full"
          />
          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="relative text-center text-xs text-theme-muted">
          <span className="bg-theme-surface px-2 relative z-10">or</span>
          <div className="absolute inset-x-0 top-1/2 border-t border-theme-border" />
        </div>

        <button onClick={signInWithGoogle} className="auth-secondary-btn">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-sm text-theme-muted">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError('')
              setMessage('')
            }}
            className="text-theme-primary hover:underline font-medium"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
