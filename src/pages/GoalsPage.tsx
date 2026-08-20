import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import type { MuscleGroup } from '../db'
import { MUSCLE_LABELS } from '../data/exercises'
import {
  DEFAULT_DAILY_MINUTES,
  DEFAULT_REST_SECONDS,
  DEFAULT_WEEKLY_WORKOUTS,
  FOCUS_OPTIONS,
  normalizeFocus,
  positiveOrDefault,
} from '../data/goals'
import {
  blurToPositiveDefault,
  clearZeroOnFocus,
  parseNumeric,
  sanitizeNumericInput,
  toNumericString,
} from '../lib/numeric'
import { DEFAULT_WATER_GOAL_ML } from '../lib/water'

const OPTIONS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full']

export function GoalsPage() {
  const { goals, preferences, updateGoals, updatePreferences } = useAuth()
  const [weekly, setWeekly] = useState(
    String(positiveOrDefault(goals?.weeklyWorkouts, DEFAULT_WEEKLY_WORKOUTS)),
  )
  const [minutes, setMinutes] = useState(
    String(positiveOrDefault(goals?.dailyMinutes, DEFAULT_DAILY_MINUTES)),
  )
  const [waterGoal, setWaterGoal] = useState(
    toNumericString(goals?.dailyWaterMl ?? DEFAULT_WATER_GOAL_ML, String(DEFAULT_WATER_GOAL_ML)),
  )
  const [focus, setFocus] = useState(normalizeFocus(goals?.focus))
  const [current, setCurrent] = useState(toNumericString(goals?.currentWeightKg, '0'))
  const [target, setTarget] = useState(toNumericString(goals?.targetWeightKg, '0'))
  const [units, setUnits] = useState(preferences?.units ?? 'kg')
  const [rest, setRest] = useState(
    String(positiveOrDefault(preferences?.restSeconds, DEFAULT_REST_SECONDS)),
  )
  const [muscles, setMuscles] = useState<MuscleGroup[]>(preferences?.preferredMuscles ?? [])
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (goals) {
      setWeekly(String(positiveOrDefault(goals.weeklyWorkouts, DEFAULT_WEEKLY_WORKOUTS)))
      setMinutes(String(positiveOrDefault(goals.dailyMinutes, DEFAULT_DAILY_MINUTES)))
      setWaterGoal(
        toNumericString(goals.dailyWaterMl ?? DEFAULT_WATER_GOAL_ML, String(DEFAULT_WATER_GOAL_ML)),
      )
      setFocus(normalizeFocus(goals.focus))
      setCurrent(toNumericString(goals.currentWeightKg, '0'))
      setTarget(toNumericString(goals.targetWeightKg, '0'))
    }
  }, [goals])

  useEffect(() => {
    if (preferences) {
      setUnits(preferences.units)
      setRest(String(positiveOrDefault(preferences.restSeconds, DEFAULT_REST_SECONDS)))
      setMuscles(preferences.preferredMuscles)
    }
  }, [preferences])

  function toggleMuscle(m: MuscleGroup) {
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setSaved(false)
    try {
      const weeklyN = positiveOrDefault(parseNumeric(weekly, 0), DEFAULT_WEEKLY_WORKOUTS)
      const minutesN = positiveOrDefault(parseNumeric(minutes, 0), DEFAULT_DAILY_MINUTES)
      const restN = positiveOrDefault(parseNumeric(rest, 0), DEFAULT_REST_SECONDS)

      setWeekly(String(weeklyN))
      setMinutes(String(minutesN))
      setRest(String(restN))

      await updateGoals({
        weeklyWorkouts: weeklyN,
        dailyMinutes: minutesN,
        dailyWaterMl: parseNumeric(waterGoal, DEFAULT_WATER_GOAL_ML) || DEFAULT_WATER_GOAL_ML,
        focus,
        currentWeightKg: parseNumeric(current, 0),
        targetWeightKg: parseNumeric(target, 0),
      })
      await updatePreferences({
        units,
        restSeconds: restN,
        preferredMuscles: muscles,
      })
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-extrabold">Goals & prefs</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Tune targets and training defaults.</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 animate-fade-up" style={{ animationDelay: '50ms' }}>
        <section className="glass rounded-[var(--radius)] p-4 space-y-3">
          <h2 className="font-display text-lg font-bold">Goals</h2>
          <div>
            <label className="label" htmlFor="weekly">How many days a week?</label>
            <input
              id="weekly"
              className="input"
              type="text"
              inputMode="numeric"
              value={weekly}
              onChange={(e) => setWeekly(sanitizeNumericInput(e.target.value))}
              onFocus={() => clearZeroOnFocus(weekly, setWeekly)}
              onBlur={() => blurToPositiveDefault(weekly, setWeekly, DEFAULT_WEEKLY_WORKOUTS)}
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
              onFocus={() => clearZeroOnFocus(minutes, setMinutes)}
              onBlur={() => blurToPositiveDefault(minutes, setMinutes, DEFAULT_DAILY_MINUTES)}
              aria-describedby="minutes-hint"
            />
            <p id="minutes-hint" className="mt-1.5 text-xs text-[var(--ink-muted)]">
              In minutes — e.g. {DEFAULT_DAILY_MINUTES}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="water-goal">Daily water goal</label>
            <input
              id="water-goal"
              className="input"
              type="text"
              inputMode="numeric"
              value={waterGoal}
              onChange={(e) => setWaterGoal(sanitizeNumericInput(e.target.value))}
              onFocus={() => clearZeroOnFocus(waterGoal, setWaterGoal)}
              onBlur={() =>
                blurToPositiveDefault(waterGoal, setWaterGoal, DEFAULT_WATER_GOAL_ML)
              }
            />
            <p className="mt-1.5 text-xs text-[var(--ink-muted)]">In ml — e.g. 2000 (2 L)</p>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="current">Current weight</label>
              <input
                id="current"
                className="input"
                type="text"
                inputMode="decimal"
                value={current}
                onChange={(e) => setCurrent(sanitizeNumericInput(e.target.value, true))}
                onFocus={() => clearZeroOnFocus(current, setCurrent)}
                onBlur={() => setCurrent(toNumericString(current, '0'))}
              />
            </div>
            <div>
              <label className="label" htmlFor="target">Target weight</label>
              <input
                id="target"
                className="input"
                type="text"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(sanitizeNumericInput(e.target.value, true))}
                onFocus={() => clearZeroOnFocus(target, setTarget)}
                onBlur={() => setTarget(toNumericString(target, '0'))}
              />
            </div>
          </div>
        </section>

        <section className="glass rounded-[var(--radius)] p-4 space-y-3">
          <h2 className="font-display text-lg font-bold">Preferences</h2>
          <div>
            <label className="label">Units</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(['kg', 'lbs'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnits(u)}
                  className={`rounded-xl px-4 py-3 font-bold ${
                    units === u ? 'bg-[var(--brand)] text-white' : 'bg-white border border-[var(--line)]'
                  }`}
                >
                  {u.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="rest">Default rest (seconds)</label>
            <input
              id="rest"
              className="input"
              type="text"
              inputMode="numeric"
              value={rest}
              onChange={(e) => setRest(sanitizeNumericInput(e.target.value))}
              onFocus={() => clearZeroOnFocus(rest, setRest)}
              onBlur={() => blurToPositiveDefault(rest, setRest, DEFAULT_REST_SECONDS)}
            />
          </div>
          <div>
            <label className="label">Preferred muscles</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {OPTIONS.map((m) => {
                const on = muscles.includes(m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMuscle(m)}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                      on ? 'bg-[var(--brand)] text-white' : 'bg-white border border-[var(--line)]'
                    }`}
                  >
                    {MUSCLE_LABELS[m]}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {saved && (
          <p className="rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand)]">
            Saved locally.
          </p>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
