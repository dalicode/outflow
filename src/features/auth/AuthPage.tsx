import { type FormEvent, useState } from 'react'
import { supabase } from '../../services/supabase'
import { withTimeout } from '../../lib/withTimeout'
import './auth.css'

type AuthMode = 'login' | 'signup'

interface AuthPageProps {
  onClose?: () => void
  onSignInSuccess?: (email?: string) => void
}

function PasswordField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="input-md w-full pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-text"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        )}
      </button>
    </div>
  )
}

export default function AuthPage({ onClose, onSignInSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    if (!supabase) {
      setError('Authentication service is not available.')
      setLoading(false)
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }
    try {
      const authRequest: Promise<{ error: { message: string } | null }> =
        mode === 'login'
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password })
      const { error: err } = await withTimeout(
        authRequest,
        20000,
        'Authentication timed out. Please try again.',
      )
      if (err) {
        setError(err.message)
        return
      }
      if (mode === 'signup') {
        setMessage('Check your email to confirm your account.')
      } else {
        onSignInSuccess?.(email)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-theme-muted hover:text-theme-text transition-colors"
          aria-label="Close"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <div className="text-center">
        <img src="/icon.svg" alt="" className="w-10 h-10 mx-auto mb-2" />
        <h1 className="text-xl font-bold text-theme-primary tracking-tight">Outflow</h1>
        <p className="text-sm text-theme-muted pb-2">
          {mode === 'login' ? 'Sign in to sync your data' : 'Create an account'}
        </p>
      </div>

      {error && <p className="text-theme-danger text-sm text-center pb-3">{error}</p>}
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
        <PasswordField value={password} onChange={setPassword} placeholder="Password" />
        {mode === 'signup' && (
          <PasswordField
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm password"
          />
        )}
        <button type="submit" disabled={loading} className="auth-submit-btn">
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <p className="text-center text-sm text-theme-muted pt-2">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
            setMessage('')
            setConfirmPassword('')
          }}
          className="text-theme-primary hover:underline font-medium"
        >
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </>
  )

  if (onClose) {
    return content
  }

  return (
    <div className="min-h-dvh bg-theme-background flex items-center justify-center px-4">
      <div className="modal-theme p-8 w-full max-w-sm space-y-5 shadow-xl">{content}</div>
    </div>
  )
}
