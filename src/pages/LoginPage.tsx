import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center px-5 py-10">
      <div className="animate-fade-up">
        <p className="font-display text-5xl font-extrabold text-[var(--brand)]">Pulse</p>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight">
          Train today.
          <br />
          Pick up tomorrow.
        </h1>
        <p className="mt-3 max-w-sm text-[var(--ink-muted)]">
          Offline-first workout log. Your sets stay on this device — sync when you want.
        </p>
      </div>

      <form onSubmit={onSubmit} className="glass mt-10 space-y-4 rounded-[var(--radius)] p-5 shadow-[var(--shadow)] animate-fade-up" style={{ animationDelay: '80ms' }}>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-[var(--danger)]">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--ink-muted)]">
        New here?{' '}
        <Link to="/register" className="font-bold text-[var(--brand)]">
          Create an account
        </Link>
      </p>
    </div>
  )
}
