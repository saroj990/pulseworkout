import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { CalendarDays, Cloud, FileSpreadsheet, LogOut, Target } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { db } from '../db'
import { exportToExcel, syncToGoogleDrive } from '../lib/sync'

export function SettingsPage() {
  const { user, preferences, logout, updatePreferences } = useAuth()
  const [clientId, setClientId] = useState(preferences?.googleClientId ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'excel' | 'drive' | 'save' | null>(null)

  useEffect(() => {
    setClientId(preferences?.googleClientId ?? '')
  }, [preferences?.googleClientId])

  const syncMeta = useLiveQuery(
    () => (user?.id ? db.syncMeta.where('userId').equals(user.id).first() : undefined),
    [user?.id],
  )

  async function saveClientId() {
    setBusy('save')
    setError('')
    setMessage('')
    try {
      await updatePreferences({ googleClientId: clientId.trim() })
      setMessage('Google Client ID saved locally.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(null)
    }
  }

  async function onExcel() {
    if (!user?.id) return
    setBusy('excel')
    setError('')
    setMessage('')
    try {
      await exportToExcel(user.id)
      setMessage('Excel file downloaded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  async function onDrive() {
    if (!user?.id) return
    setBusy('drive')
    setError('')
    setMessage('')
    try {
      const id = clientId.trim() || preferences?.googleClientId || ''
      await syncToGoogleDrive(user.id, id)
      setMessage('Uploaded to Google Drive as pulse-workouts.xlsx')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Drive sync failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-extrabold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Account, sync, and device storage.</p>
      </header>

      <section className="glass animate-fade-up rounded-[var(--radius)] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">Signed in</p>
        <p className="mt-1 font-display text-xl font-bold">{user?.name}</p>
        <p className="text-sm text-[var(--ink-muted)]">{user?.email}</p>
        <button type="button" className="btn btn-secondary mt-4 w-full" onClick={logout}>
          <LogOut size={16} /> Sign out
        </button>
      </section>

      <section className="glass animate-fade-up rounded-[var(--radius)] p-4" style={{ animationDelay: '80ms' }}>
        <h2 className="font-display text-lg font-bold">Goals</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Weekly targets, water goal, and preferred muscles.
        </p>
        <Link to="/goals" className="btn btn-secondary mt-3 w-full">
          <Target size={16} /> Edit goals
        </Link>
      </section>

      <section className="glass animate-fade-up rounded-[var(--radius)] p-4" style={{ animationDelay: '90ms' }}>
        <h2 className="font-display text-lg font-bold">Workout plans</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Bro split, PPL, or build your own weekly schedule.
        </p>
        <Link to="/plans" className="btn btn-secondary mt-3 w-full">
          <CalendarDays size={16} /> Open plans
        </Link>
      </section>

      <section className="glass animate-fade-up rounded-[var(--radius)] p-4 space-y-3" style={{ animationDelay: '60ms' }}>
        <h2 className="font-display text-lg font-bold">Export & sync</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Workouts live in IndexedDB. Optionally export to Excel or upload a spreadsheet to your Google Drive.
        </p>

        <button type="button" className="btn btn-primary w-full" onClick={onExcel} disabled={busy !== null}>
          <FileSpreadsheet size={16} />
          {busy === 'excel' ? 'Exporting…' : 'Download Excel (.xlsx)'}
        </button>
        {syncMeta?.lastExcelExportAt && (
          <p className="text-xs text-[var(--ink-muted)]">
            Last Excel export: {format(parseISO(syncMeta.lastExcelExportAt), 'MMM d, yyyy HH:mm')}
          </p>
        )}

        <div className="border-t border-[var(--line)] pt-3 space-y-3">
          <label className="label" htmlFor="gid">Google OAuth Client ID (optional)</label>
          <input
            id="gid"
            className="input"
            placeholder="xxxx.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <p className="text-xs text-[var(--ink-muted)]">
            Create an OAuth client in Google Cloud Console with this origin allowed, enable Drive API, then paste the Client ID.
          </p>
          <button type="button" className="btn btn-secondary w-full" onClick={saveClientId} disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save Client ID'}
          </button>
          <button type="button" className="btn btn-accent w-full" onClick={onDrive} disabled={busy !== null}>
            <Cloud size={16} />
            {busy === 'drive' ? 'Syncing…' : 'Sync to Google Drive'}
          </button>
          {syncMeta?.lastDriveSyncAt && (
            <p className="text-xs text-[var(--ink-muted)]">
              Last Drive sync: {format(parseISO(syncMeta.lastDriveSyncAt), 'MMM d, yyyy HH:mm')}
            </p>
          )}
        </div>
      </section>

      {(message || error) && (
        <p
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            error
              ? 'bg-red-50 text-[var(--danger)]'
              : 'bg-[var(--brand-soft)] text-[var(--brand)]'
          }`}
        >
          {error || message}
        </p>
      )}

      <section className="glass animate-fade-up rounded-[var(--radius)] p-4" style={{ animationDelay: '100ms' }}>
        <h2 className="font-display text-lg font-bold">Offline</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Pulse is a PWA. Install it to your home screen for app-like use. All logging works without a network.
        </p>
      </section>
    </div>
  )
}
