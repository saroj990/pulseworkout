import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/onboarding" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(name, email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center px-5 py-10">
      <div className="animate-fade-up">
        <p className="font-display text-4xl font-extrabold text-[var(--brand)]">Pulse</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Create your space</h1>
        <p className="mt-2 text-[var(--ink-muted)]">
          Accounts live in IndexedDB on this device — no cloud required.
        </p>
      </div>

      <form onSubmit={onSubmit} className="glass mt-8 space-y-4 rounded-[var(--radius)] p-5 shadow-[var(--shadow)] animate-fade-up">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input
            id="name"
            className="input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
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
          {busy ? 'Creating…' : 'Get started'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--ink-muted)]">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-[var(--brand)]">
          Sign in
        </Link>
      </p>
    </div>
  )
}
