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
    <div className="auth-shell">
      <section className="auth-hero-panel animate-fade-up">
        <p className="font-display text-6xl font-extrabold">Pulse</p>
        <h1 className="mt-6 max-w-md font-display text-4xl font-bold leading-tight">
          Train today.
          <br />
          Pick up tomorrow.
        </h1>
        <p className="mt-4 max-w-md text-base text-teal-50/90">
          Offline-first workout log for laptop and phone. Your sets stay on this device — sync when you want.
        </p>
        <ul className="mt-10 space-y-3 text-sm font-semibold text-teal-50/95">
          <li>• Daily workouts, plans, and water tracking</li>
          <li>• Works fully offline with IndexedDB</li>
          <li>• Optional Excel / Google Drive export</li>
        </ul>
      </section>

      <section className="auth-form-panel">
        <div className="mx-auto w-full max-w-md animate-fade-up lg:hidden">
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

        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 hidden animate-fade-up lg:block">
            <p className="text-sm font-bold uppercase tracking-wider text-[var(--brand)]">Welcome back</p>
            <h2 className="mt-1 font-display text-3xl font-bold">Sign in</h2>
          </div>

          <form
            onSubmit={onSubmit}
            className="glass mt-8 space-y-4 rounded-[var(--radius)] p-5 shadow-[var(--shadow)] animate-fade-up lg:mt-0"
            style={{ animationDelay: '80ms' }}
          >
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
      </section>
    </div>
  )
}
