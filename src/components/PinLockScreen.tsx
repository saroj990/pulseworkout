import { useState } from 'react'
import { Delete, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePinLock } from '../context/PinLockContext'
import { PIN_LENGTH } from '../lib/pin'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

export function PinLockScreen() {
  const { user, logout } = useAuth()
  const { unlockWithPin } = usePinLock()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function tryUnlock(nextPin: string) {
    if (nextPin.length !== PIN_LENGTH || busy) return
    setBusy(true)
    setError('')
    try {
      await unlockWithPin(nextPin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect PIN.')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  function press(key: string) {
    if (busy) return
    setError('')
    if (key === 'del') {
      setPin((p) => p.slice(0, -1))
      return
    }
    if (!key) return
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev
      const next = prev + key
      if (next.length === PIN_LENGTH) {
        void tryUnlock(next)
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--bg)] px-5">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Lock size={26} />
        </div>
        <h1 className="mt-4 text-center font-display text-2xl font-extrabold">Enter PIN</h1>
        <p className="mt-1 text-center text-sm text-[var(--ink-muted)]">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Unlock Pulse to continue.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 transition ${
                i < pin.length
                  ? 'border-[var(--brand)] bg-[var(--brand)]'
                  : 'border-[var(--line)] bg-white'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm font-semibold text-[var(--danger)]">{error}</p>
        )}

        <div className="mx-auto mt-8 grid max-w-xs grid-cols-3 gap-3">
          {KEYS.map((key, idx) => {
            if (!key) return <div key={`empty-${idx}`} />
            if (key === 'del') {
              return (
                <button
                  key={key}
                  type="button"
                  className="flex h-16 items-center justify-center rounded-2xl bg-white text-[var(--ink-muted)] border border-[var(--line)] active:scale-95"
                  onClick={() => press('del')}
                  aria-label="Delete"
                  disabled={busy}
                >
                  <Delete size={22} />
                </button>
              )
            }
            return (
              <button
                key={key}
                type="button"
                className="flex h-16 items-center justify-center rounded-2xl bg-white text-xl font-bold border border-[var(--line)] active:scale-95 hover:border-[var(--brand)]"
                onClick={() => press(key)}
                disabled={busy}
              >
                {key}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="btn btn-ghost mx-auto mt-8 block text-sm"
          onClick={logout}
        >
          Sign out instead
        </button>
      </div>
    </div>
  )
}
