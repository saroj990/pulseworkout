import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { db, type Exercise } from '../db'
import {
  ADMIN_EXERCISE_CATEGORIES,
  addCustomExercise,
  deleteCustomExercise,
  filterExercisesForAdminCategory,
  filterVisibleExercises,
  type AdminExerciseCategory,
} from '../lib/userExercises'

export function ExerciseAdminPage() {
  const { user, preferences, updatePreferences } = useAuth()
  const [category, setCategory] = useState<AdminExerciseCategory>('back')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const allExercises = useLiveQuery(() => db.exercises.toArray(), [])
  const hidden = preferences?.hiddenExerciseNames ?? []

  const visibleAll = useMemo(
    () => filterVisibleExercises(allExercises ?? [], user?.id, hidden),
    [allExercises, user?.id, hidden],
  )

  const listed = useMemo(
    () => filterExercisesForAdminCategory(allExercises ?? [], category),
    [allExercises, category],
  )

  const hiddenSet = useMemo(
    () => new Set(hidden.map((n) => n.trim().toLowerCase())),
    [hidden],
  )

  function isHidden(ex: Exercise): boolean {
    return hiddenSet.has(ex.name.trim().toLowerCase())
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const trimmed = name.trim()
      await addCustomExercise(user.id, trimmed, category)
      setName('')
      setMessage(`Added “${trimmed}”.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add exercise')
    } finally {
      setBusy(false)
    }
  }

  async function onRemove(ex: Exercise) {
    if (!user?.id) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (ex.isCustom && ex.userId === user.id && ex.id != null) {
        await deleteCustomExercise(user.id, ex.id)
        setMessage(`Removed “${ex.name}”.`)
        return
      }
      const nextHidden = [...hidden]
      const key = ex.name.trim()
      if (!nextHidden.some((n) => n.toLowerCase() === key.toLowerCase())) {
        nextHidden.push(key)
      }
      await updatePreferences({ hiddenExerciseNames: nextHidden })
      setMessage(`Removed “${ex.name}” from your library.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove exercise')
    } finally {
      setBusy(false)
    }
  }

  async function onRestore(ex: Exercise) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const nextHidden = hidden.filter(
        (n) => n.trim().toLowerCase() !== ex.name.trim().toLowerCase(),
      )
      await updatePreferences({ hiddenExerciseNames: nextHidden })
      setMessage(`Restored “${ex.name}”.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore exercise')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 pb-4">
      <header className="animate-fade-up">
        <Link to="/settings" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--brand)]">
          <ArrowLeft size={16} /> Settings
        </Link>
        <h1 className="font-display text-3xl font-extrabold text-[var(--ink)]">Exercise library</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Add custom moves or remove names you don’t use. Changes apply in Log → pick exercises.
        </p>
        <p className="mt-1 text-xs font-semibold text-[var(--ink-muted)]">
          {visibleAll.length} exercises visible in your library
        </p>
      </header>

      <section className="glass animate-fade-up rounded-[var(--radius)] p-4 space-y-3">
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">Muscle group</h2>
        <div className="flex flex-wrap gap-1.5">
          {ADMIN_EXERCISE_CATEGORIES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                category === tab.id
                  ? 'bg-[var(--brand)] text-white'
                  : 'border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setCategory(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="glass animate-fade-up rounded-[var(--radius)] p-4 space-y-3">
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">Add exercise</h2>
        <form onSubmit={(e) => void onAdd(e)} className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="Exercise name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={busy || !name.trim()}>
            <Plus size={16} /> Add
          </button>
        </form>
      </section>

      {(error || message) && (
        <p
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            error
              ? 'border border-[var(--danger)]/25 bg-[color-mix(in_srgb,var(--danger)_10%,var(--bg-elevated))] text-[var(--danger)]'
              : 'bg-[var(--brand-soft)] text-[var(--brand)]'
          }`}
        >
          {error || message}
        </p>
      )}

      <section className="glass animate-fade-up rounded-[var(--radius)] p-4">
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">
          {ADMIN_EXERCISE_CATEGORIES.find((c) => c.id === category)?.label} · {listed.length}
        </h2>
        <ul className="mt-3 max-h-[min(52dvh,28rem)] space-y-1 overflow-y-auto overscroll-contain">
          {listed.map((ex) => {
            const hiddenRow = isHidden(ex)
            const custom = ex.isCustom && ex.userId === user?.id
            return (
              <li
                key={ex.id ?? ex.name}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  hiddenRow
                    ? 'border-dashed border-[var(--line)] bg-[var(--bg-elevated)]/50 text-[var(--ink-muted)]'
                    : 'border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--ink)]'
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-semibold">{ex.name}</span>
                {custom && (
                  <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[0.6rem] font-bold text-[var(--brand)]">
                    Yours
                  </span>
                )}
                {hiddenRow ? (
                  <button
                    type="button"
                    className="btn btn-secondary shrink-0 px-2.5 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => void onRestore(ex)}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost shrink-0 px-2 py-1.5 text-[var(--danger)]"
                    aria-label={`Remove ${ex.name}`}
                    disabled={busy}
                    onClick={() => void onRemove(ex)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            )
          })}
          {listed.length === 0 && (
            <li className="py-6 text-center text-sm text-[var(--ink-muted)]">No exercises in this group.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
