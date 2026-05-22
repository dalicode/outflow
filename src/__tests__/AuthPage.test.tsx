import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthPage from '../features/auth/AuthPage'

const { signInWithPassword, signUp } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword,
      signUp,
    },
  },
}))

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls onSignInSuccess once with email after successful login', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    const onSignInSuccess = vi.fn()

    render(<AuthPage onSignInSuccess={onSignInSuccess} />)

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(onSignInSuccess).toHaveBeenCalledTimes(1)
    })
    expect(onSignInSuccess).toHaveBeenCalledWith('user@example.com')
  })

  it('does not call onSignInSuccess when login fails', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const onSignInSuccess = vi.fn()

    render(<AuthPage onSignInSuccess={onSignInSuccess} />)

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'wrong-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await screen.findByText('Invalid login credentials')
    expect(onSignInSuccess).not.toHaveBeenCalled()
  })

  it('does not call onSignInSuccess when sign-up succeeds', async () => {
    signUp.mockResolvedValue({ error: null })
    const onSignInSuccess = vi.fn()

    render(<AuthPage onSignInSuccess={onSignInSuccess} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'new-user@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))

    await screen.findByText('Check your email to confirm your account.')
    expect(onSignInSuccess).not.toHaveBeenCalled()
  })
})
