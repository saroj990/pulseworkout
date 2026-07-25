import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { MuscleGroup } from '../db'
import { MUSCLE_LABELS } from '../data/exercises'
import { FOCUS_OPTIONS, normalizeFocus } from '../data/goals'
import { parseNumeric, sanitizeNumericInput, toNumericString } from '../lib/numeric'

const OPTIONS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full']

export function OnboardingPage() {
  const { user, preferences, goals, updatePreferences, updateGoals } = useAuth()
  const [units, setUnits] = useState<'kg' | 'lbs'>(preferences?.units ?? 'kg')
  const [weekly, setWeekly] = useState(toNumericString(goals?.weeklyWorkouts, '0'))
  const [minutes, setMinutes] = useState(toNumericString(goals?.dailyMinutes, '0'))
  const [focus, setFocus] = useState(normalizeFocus(goals?.focus))
  const [muscles, setMuscles] = useState<MuscleGroup[]>(preferences?.preferredMuscles ?? [])
  const [busy, setBusy] = useState(false)

  if (!user) return <Navigate to="/login" replace />
  if (preferences?.onboardingDone) return <Navigate to="/" replace />

  function toggleMuscle(m: MuscleGroup) {
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await updatePreferences({
        units,
        preferredMuscles: muscles,
        onboardingDone: true,
      })
      await updateGoals({
        weeklyWorkouts: parseNumeric(weekly, 0),
        dailyMinutes: parseNumeric(minutes, 0),
        focus,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-5 py-10">
      <div className="animate-fade-up">
        <p className="text-sm font-bold uppercase tracking-wider text-[var(--brand)]">Welcome, {user.name}</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Set your preferences</h1>
        <p className="mt-2 text-[var(--ink-muted)]">You can change these anytime in Settings.</p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <section className="glass rounded-[var(--radius)] p-5">
          <label className="label">Units</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['kg', 'lbs'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnits(u)}
                className={`rounded-xl px-4 py-3 font-bold ${
                  units === u
                    ? 'bg-[var(--brand)] text-white'
                    : 'bg-white border border-[var(--line)]'
                }`}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="glass rounded-[var(--radius)] p-5 space-y-4">
          <div>
            <label className="label" htmlFor="weekly">How many days a week?</label>
            <input
              id="weekly"
              className="input"
              type="text"
              inputMode="numeric"
              value={weekly}
              onChange={(e) => setWeekly(sanitizeNumericInput(e.target.value))}
              onBlur={() => setWeekly(toNumericString(weekly, '0'))}
            />
          </div>
          <div>
            <label className="label" htmlFor="minutes">How long each session?</label>
            <input
              id="minutes"
              className="input"
              type="text"
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(sanitizeNumericInput(e.target.value))}
              onBlur={() => setMinutes(toNumericString(minutes, '0'))}
              aria-describedby="minutes-hint"
            />
            <p id="minutes-hint" className="mt-1.5 text-xs text-[var(--ink-muted)]">
              In minutes — e.g. 45
            </p>
          </div>
          <div>
            <label className="label" htmlFor="focus">What’s your focus?</label>
            <select
              id="focus"
              className="input"
              value={focus}
              onChange={(e) => setFocus(normalizeFocus(e.target.value))}
            >
              {FOCUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="glass rounded-[var(--radius)] p-5">
          <label className="label">Preferred muscles</label>
          <div className="mt-3 flex flex-wrap gap-2">
            {OPTIONS.map((m) => {
              const on = muscles.includes(m)
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMuscle(m)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                    on
                      ? 'bg-[var(--brand)] text-white'
                      : 'bg-white border border-[var(--line)] text-[var(--ink-muted)]'
                  }`}
                >
                  {MUSCLE_LABELS[m]}
                </button>
              )
            })}
          </div>
        </section>

        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Start training'}
        </button>
      </form>
    </div>
  )
}
