import { Link } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatOldestLabel } from '../lib/storageAlert'

export function OldDataAlertModal() {
  const { storageAlert, clearStorageAlert } = useAuth()

  if (!storageAlert?.hasOldData) return null

  const total = storageAlert.workoutCount + storageAlert.waterCount
  const oldest = formatOldestLabel(storageAlert.oldestDate)

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div
        role="alertdialog"
        aria-labelledby="old-data-title"
        aria-describedby="old-data-desc"
        className="w-full max-w-md rounded-t-[1.5rem] bg-[var(--bg)] p-5 shadow-[var(--shadow)] sm:rounded-[var(--radius)] animate-fade-up"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <AlertTriangle size={22} />
          </div>
          <button
            type="button"
            className="btn btn-ghost p-2"
            onClick={clearStorageAlert}
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>

        <h2 id="old-data-title" className="mt-3 font-display text-xl font-bold">
          Data older than 6 months
        </h2>
        <p id="old-data-desc" className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
          You have {total} record{total === 1 ? '' : 's'} on this device from more than 6 months ago
          {oldest ? ` (oldest: ${oldest})` : ''}. IndexedDB can hold a lot, but it’s wise to export a
          backup so nothing is lost if this browser’s data is cleared.
        </p>

        {(storageAlert.workoutCount > 0 || storageAlert.waterCount > 0) && (
          <ul className="mt-3 space-y-1 text-sm font-semibold text-[var(--ink)]">
            {storageAlert.workoutCount > 0 && (
              <li>• {storageAlert.workoutCount} workout session{storageAlert.workoutCount === 1 ? '' : 's'}</li>
            )}
            {storageAlert.waterCount > 0 && (
              <li>• {storageAlert.waterCount} water entr{storageAlert.waterCount === 1 ? 'y' : 'ies'}</li>
            )}
          </ul>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn btn-secondary flex-1" onClick={clearStorageAlert}>
            Got it
          </button>
          <Link
            to="/settings"
            className="btn btn-primary flex-1"
            onClick={clearStorageAlert}
          >
            Export backup
          </Link>
        </div>
      </div>
    </div>
  )
}
