import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { usePinLock } from '../context/PinLockContext'
import { PIN_LENGTH } from '../lib/pin'

type Mode = 'idle' | 'enable' | 'change' | 'disable'

export function PinSettingsCard() {
  const { pinEnabled, enablePin, changePin, disablePin } = usePinLock()
  const [mode, setMode] = useState<Mode>('idle')
  const [currentPin, setCurrentPin] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function resetFields() {
    setCurrentPin('')
    setPin('')
    setConfirmPin('')
    setError('')
  }

  function close() {
    setMode('idle')
    resetFields()
  }

  async function onSubmit() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'enable') {
        await enablePin(pin, confirmPin)
        setMessage('PIN lock turned on.')
      } else if (mode === 'change') {
        await changePin(currentPin, pin, confirmPin)
        setMessage('PIN updated.')
      } else if (mode === 'disable') {
        await disablePin(currentPin)
        setMessage('PIN lock turned off.')
      }
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update PIN')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="glass animate-fade-up rounded-[var(--radius)] p-4 space-y-3" style={{ animationDelay: '70ms' }}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <KeyRound size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold">App PIN lock</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {pinEnabled
              ? 'PIN is on. You’ll be asked for it whenever Pulse is reopened or comes back from the background.'
              : 'Add a 4-digit PIN to lock Pulse when you leave the app.'}
          </p>
        </div>
      </div>

      {mode === 'idle' && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {!pinEnabled ? (
            <button type="button" className="btn btn-primary flex-1" onClick={() => setMode('enable')}>
              Set PIN
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary flex-1" onClick={() => setMode('change')}>
                Change PIN
              </button>
              <button
                type="button"
                className="btn flex-1 border border-red-200 bg-red-50 text-[var(--danger)]"
                onClick={() => setMode('disable')}
              >
                Turn off PIN
              </button>
            </>
          )}
        </div>
      )}

      {mode !== 'idle' && (
        <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-3">
          {(mode === 'change' || mode === 'disable') && (
            <div>
              <label className="label" htmlFor="current-pin">Current PIN</label>
              <input
                id="current-pin"
                className="input tracking-[0.35em]"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={PIN_LENGTH}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
              />
            </div>
          )}
          {(mode === 'enable' || mode === 'change') && (
            <>
              <div>
                <label className="label" htmlFor="new-pin">
                  {mode === 'change' ? 'New PIN' : 'PIN'}
                </label>
                <input
                  id="new-pin"
                  className="input tracking-[0.35em]"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={PIN_LENGTH}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                />
              </div>
              <div>
                <label className="label" htmlFor="confirm-pin">Confirm PIN</label>
                <input
                  id="confirm-pin"
                  className="input tracking-[0.35em]"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={PIN_LENGTH}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                />
              </div>
            </>
          )}
          {error && <p className="text-xs font-semibold text-[var(--danger)]">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={onSubmit} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand)]">
          {message}
        </p>
      )}
    </section>
  )
}
