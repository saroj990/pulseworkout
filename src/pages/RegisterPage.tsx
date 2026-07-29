import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  sanitizePinInput,
  validateRegisterInput,
  type AuthFieldErrors,
} from '../lib/authValidation'
import { PIN_LENGTH } from '../lib/pin'

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({})
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/onboarding" replace />

  function clearFieldError(key: keyof AuthFieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errors = validateRegisterInput(name, pin)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields.')
      return
    }

    setError('')
    setBusy(true)
    try {
      await register(name, pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-hero-panel animate-fade-up">
        <p className="font-display text-6xl font-extrabold">Pulse</p>
        <h1 className="mt-6 max-w-md font-display text-4xl font-bold leading-tight">
          Create your training space
        </h1>
        <p className="mt-4 max-w-md text-base text-teal-50/90">
          Accounts live in IndexedDB on this device — no cloud required to start logging.
        </p>
      </section>

      <section className="auth-form-panel">
        <div className="mx-auto w-full max-w-md animate-fade-up lg:hidden">
          <p className="font-display text-4xl font-extrabold text-[var(--brand)]">Pulse</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Create your space</h1>
          <p className="mt-2 text-[var(--ink-muted)]">
            Accounts live in IndexedDB on this device — no cloud required.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 hidden animate-fade-up lg:block">
            <p className="text-sm font-bold uppercase tracking-wider text-[var(--brand)]">Get started</p>
            <h2 className="mt-1 font-display text-3xl font-bold">Create account</h2>
          </div>

          <form
            onSubmit={onSubmit}
            noValidate
            className="glass mt-8 space-y-4 rounded-[var(--radius)] p-5 shadow-[var(--shadow)] animate-fade-up lg:mt-0"
          >
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input
                id="name"
                className={`input ${fieldErrors.name ? 'border-[var(--danger)]' : ''}`}
                type="text"
                autoComplete="username"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  clearFieldError('name')
                  setError('')
                }}
              />
              {fieldErrors.name && (
                <p className="mt-1.5 text-xs font-semibold text-[var(--danger)]">{fieldErrors.name}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="pin">4-digit PIN</label>
              <input
                id="pin"
                className={`input tracking-[0.35em] ${fieldErrors.pin ? 'border-[var(--danger)]' : ''}`}
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={PIN_LENGTH}
                value={pin}
                onChange={(e) => {
                  setPin(sanitizePinInput(e.target.value))
                  clearFieldError('pin')
                  setError('')
                }}
              />
              {fieldErrors.pin ? (
                <p className="mt-1.5 text-xs font-semibold text-[var(--danger)]">{fieldErrors.pin}</p>
              ) : (
                <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                  You’ll use this PIN to sign in on this device.
                </p>
              )}
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
      </section>
    </div>
  )
}
