import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, LogOut, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { clearUserTrainingData, exportToCsv } from '../lib/dataActions'

function initials(name?: string, email?: string) {
  const source = (name || email || 'U').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function ProfileMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState<'csv' | 'clear' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setConfirmClear(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setConfirmClear(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  async function onExportCsv() {
    if (!user?.id) return
    setBusy('csv')
    setError('')
    setMessage('')
    try {
      await exportToCsv(user.id)
      setMessage('CSV files downloaded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed')
    } finally {
      setBusy(null)
    }
  }

  async function onClearData() {
    if (!user?.id) return
    setBusy('clear')
    setError('')
    setMessage('')
    try {
      await clearUserTrainingData(user.id)
      setMessage('Workouts, water, and plans cleared.')
      setConfirmClear(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear data')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={`inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white transition hover:border-[var(--brand)] ${
          compact ? 'p-1' : 'pl-1.5 pr-3 py-1'
        }`}
        onClick={() => {
          setOpen((v) => !v)
          setConfirmClear(false)
          setMessage('')
          setError('')
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Profile menu"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-white">
          {user ? initials(user.name, user.email) : <UserRound size={16} />}
        </span>
        {!compact && (
          <span className="hidden text-left sm:block">
            <span className="block max-w-[8rem] truncate text-sm font-bold leading-tight">
              {user?.name?.split(' ')[0] || 'Profile'}
            </span>
            <span className="block text-[0.65rem] font-semibold text-[var(--ink-muted)]">Account</span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(18.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow)] animate-fade-up"
        >
          <div className="border-b border-[var(--line)] px-4 py-3">
            <p className="truncate font-bold">{user?.name}</p>
            <p className="truncate text-xs text-[var(--ink-muted)]">{user?.email}</p>
          </div>

          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-[var(--brand-soft)]"
              disabled={busy !== null}
              onClick={onExportCsv}
            >
              <FileSpreadsheet size={16} />
              {busy === 'csv' ? 'Exporting…' : 'Export data to CSV'}
            </button>

            {!confirmClear ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[var(--danger)] hover:bg-red-50"
                disabled={busy !== null}
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 size={16} />
                Clear my data
              </button>
            ) : (
              <div className="rounded-xl bg-red-50 p-3">
                <p className="text-xs font-semibold text-[var(--danger)]">
                  Delete workouts, water logs, and plans? Account stays signed in.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary flex-1 py-1.5 text-xs"
                    onClick={() => setConfirmClear(false)}
                    disabled={busy !== null}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn flex-1 bg-[var(--danger)] py-1.5 text-xs text-white"
                    onClick={onClearData}
                    disabled={busy !== null}
                  >
                    {busy === 'clear' ? 'Clearing…' : 'Clear'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-[var(--bg)]"
              onClick={() => {
                setOpen(false)
                logout()
              }}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>

          {(message || error) && (
            <p
              className={`border-t border-[var(--line)] px-4 py-2 text-xs font-semibold ${
                error ? 'bg-red-50 text-[var(--danger)]' : 'bg-[var(--brand-soft)] text-[var(--brand)]'
              }`}
            >
              {error || message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
