import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import {
  Check,
  ChevronDown,
  CircleCheck,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { db, type Exercise, type MuscleGroup, type WorkoutExercise, type WorkoutSet } from '../db'
import { MUSCLE_LABELS } from '../data/exercises'
import { ExerciseImage } from '../components/ExerciseImage'
import { PART_WORKOUTS, getPlanDayForDate } from '../data/plans'
import { parseNumeric, sanitizeNumericInput, toNumericString } from '../lib/numeric'

function emptySet(): WorkoutSet {
  return { reps: 0, weight: 0, completed: false }
}

function toWorkoutExercise(ex: Exercise): WorkoutExercise {
  return {
    exerciseId: ex.id!,
    exerciseName: ex.name,
    muscle: ex.muscle,
    imageKey: ex.imageKey,
    sets: [emptySet(), emptySet(), emptySet()],
  }
}

type FieldErrors = {
  title?: string
  date?: string
  duration?: string
  exercises?: string
  sets?: string
}

function validateWorkout(input: {
  title: string
  date: string
  duration: string
  selected: WorkoutExercise[]
}): FieldErrors {
  const errors: FieldErrors = {}

  if (!input.title.trim()) {
    errors.title = 'Add a workout title.'
  }

  if (!input.date) {
    errors.date = 'Choose a date.'
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.date = 'Enter a valid date.'
  }

  const minutes = parseNumeric(input.duration, 0)
  if (minutes <= 0) {
    errors.duration = 'Session length must be greater than 0.'
  } else if (minutes > 600) {
    errors.duration = 'Session length looks too long (max 600 min).'
  }

  if (input.selected.length === 0) {
    errors.exercises = 'Add at least one exercise.'
  } else {
    const missingSets = input.selected.some((ex) => ex.sets.length === 0)
    if (missingSets) {
      errors.sets = 'Each exercise needs at least one set.'
    } else {
      const badReps = input.selected.some((ex) => ex.sets.some((s) => s.reps <= 0))
      if (badReps) {
        errors.sets = 'Every set needs reps greater than 0.'
      }
      const badWeight = input.selected.some((ex) =>
        ex.sets.some((s) => !Number.isFinite(s.weight) || s.weight < 0),
      )
      if (!errors.sets && badWeight) {
        errors.sets = 'Weight can’t be negative.'
      }
    }
  }

  return errors
}

export function LogWorkoutPage() {
  const { user, preferences } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const units = preferences?.units ?? 'kg'
  const restSeconds = preferences?.restSeconds ?? 90
  const prefillsApplied = useRef(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const activePlan = useLiveQuery(async () => {
    if (!user?.id) return undefined
    return db.userPlans.where('userId').equals(user.id).filter((p) => p.active).first()
  }, [user?.id])

  const [title, setTitle] = useState(`Workout — ${format(new Date(), 'MMM d')}`)
  const [date, setDate] = useState(today)
  const [duration, setDuration] = useState('0')
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<WorkoutExercise[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'all'>('all')
  const [restLeft, setRestLeft] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const existingForDate = useLiveQuery(async () => {
    if (!user?.id || !date) return undefined
    const matches = await db.workouts
      .where('userId')
      .equals(user.id)
      .filter((w) => w.date === date)
      .toArray()
    return matches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  }, [user?.id, date])

  const alreadyLogged = Boolean(existingForDate)
  const isToday = date === today

  useEffect(() => {
    if (prefillsApplied.current || !exercises?.length || alreadyLogged) return

    const part = searchParams.get('part') as MuscleGroup | null
    const fromPlan = searchParams.get('fromPlan') === '1'
    const byName = new Map(exercises.map((e) => [e.name, e]))

    if (part && PART_WORKOUTS[part]) {
      const workout = PART_WORKOUTS[part]
      const picked = workout.exerciseNames
        .map((n) => byName.get(n))
        .filter((e): e is Exercise => Boolean(e?.id))
      if (picked.length) {
        setTitle(workout.title)
        setSelected(picked.map(toWorkoutExercise))
        setMuscleFilter(part)
        prefillsApplied.current = true
      }
      return
    }

    if (fromPlan && activePlan) {
      const day = getPlanDayForDate(activePlan.days, new Date())
      if (day && day.muscles.length > 0) {
        const picked = day.exerciseNames
          .map((n) => byName.get(n))
          .filter((e): e is Exercise => Boolean(e?.id))
        if (picked.length) {
          setTitle(day.title)
          setSelected(picked.map(toWorkoutExercise))
          if (day.muscles.length === 1) setMuscleFilter(day.muscles[0])
          prefillsApplied.current = true
        }
      }
    }
  }, [exercises, activePlan, searchParams, alreadyLogged])

  const filtered = useMemo(() => {
    const list = exercises ?? []
    return list.filter((ex) => {
      const q = query.trim().toLowerCase()
      const matchQ = !q || ex.name.toLowerCase().includes(q)
      const matchM = muscleFilter === 'all' || ex.muscle === muscleFilter
      return matchQ && matchM
    })
  }, [exercises, query, muscleFilter])

  function clearFieldError(key: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function addExercise(ex: Exercise) {
    if (alreadyLogged || !ex.id) return
    if (selected.some((s) => s.exerciseId === ex.id)) return
    setSelected((prev) => [...prev, toWorkoutExercise(ex)])
    clearFieldError('exercises')
    clearFieldError('sets')
    setPickerOpen(false)
  }

  function updateSet(exIdx: number, setIdx: number, patch: Partial<WorkoutSet>) {
    if (alreadyLogged) return
    setSelected((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)),
            },
      ),
    )
    clearFieldError('sets')
  }

  function addSet(exIdx: number) {
    if (alreadyLogged) return
    setSelected((prev) =>
      prev.map((ex, i) => (i === exIdx ? { ...ex, sets: [...ex.sets, emptySet()] } : ex)),
    )
    clearFieldError('sets')
  }

  function removeSet(exIdx: number, setIdx: number) {
    if (alreadyLogged) return
    setSelected((prev) =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex,
      ),
    )
  }

  function removeExercise(exIdx: number) {
    if (alreadyLogged) return
    setSelected((prev) => prev.filter((_, i) => i !== exIdx))
  }

  function startRest() {
    if (alreadyLogged) return
    setRestLeft(restSeconds)
    const tick = window.setInterval(() => {
      setRestLeft((v) => {
        if (v == null || v <= 1) {
          window.clearInterval(tick)
          return null
        }
        return v - 1
      })
    }, 1000)
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!user?.id || alreadyLogged) return

    const errors = validateWorkout({ title, date, duration, selected })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields before saving.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const duplicate = await db.workouts
        .where('userId')
        .equals(user.id)
        .filter((w) => w.date === date)
        .first()
      if (duplicate) {
        setError('A workout is already logged for this day.')
        setBusy(false)
        return
      }

      const now = new Date().toISOString()
      const id = await db.workouts.add({
        userId: user.id,
        date,
        title: title.trim(),
        notes: notes.trim(),
        durationMin: parseNumeric(duration, 0),
        exercises: selected,
        createdAt: now,
        updatedAt: now,
      })
      navigate(`/history/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save workout')
    } finally {
      setBusy(false)
    }
  }

  const muscles: Array<MuscleGroup | 'all'> = [
    'all',
    'chest',
    'back',
    'shoulders',
    'arms',
    'legs',
    'core',
    'cardio',
    'full',
  ]

  if (alreadyLogged && existingForDate) {
    return (
      <div className="space-y-5">
        <header className="animate-fade-up">
          <h1 className="font-display text-3xl font-extrabold">Log workout</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            One session per day keeps your streak and history clean.
          </p>
        </header>

        <section className="glass animate-fade-up overflow-hidden rounded-[var(--radius)]">
          <div className="bg-[linear-gradient(135deg,var(--brand)_0%,#0b5550_100%)] px-5 py-6 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
              <CircleCheck size={22} />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold">
              {isToday ? 'Already logged today' : 'Already logged for this day'}
            </h2>
            <p className="mt-2 text-sm text-teal-50/90">
              You logged <span className="font-bold text-white">{existingForDate.title}</span> on{' '}
              {format(new Date(`${existingForDate.date}T12:00:00`), 'MMM d, yyyy')}. Logging again
              for the same day is turned off.
            </p>
          </div>
          <div className="space-y-3 p-5">
            <div className="rounded-2xl bg-white border border-[var(--line)] px-4 py-3 text-sm">
              <p className="font-bold">{existingForDate.title}</p>
              <p className="mt-1 text-[var(--ink-muted)]">
                {existingForDate.durationMin} min · {existingForDate.exercises.length} exercises
              </p>
            </div>
            <Link to={`/history/${existingForDate.id}`} className="btn btn-primary w-full">
              View session
            </Link>
            <Link to="/history" className="btn btn-secondary w-full">
              Open history
            </Link>
            {!isToday && (
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => setDate(today)}
              >
                Switch to today
              </button>
            )}
          </div>
        </section>

        <section className="glass animate-fade-up rounded-[var(--radius)] p-4">
          <label className="label" htmlFor="other-date">
            Log a different day?
          </label>
          <input
            id="other-date"
            className="input"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className="mt-2 text-xs text-[var(--ink-muted)]">
            Pick an open date with no session yet to start a new log.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-extrabold">Log workout</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Everything saves to IndexedDB on this device.
        </p>
      </header>

      <form onSubmit={onSave} className="space-y-4" noValidate>
        <section className="glass animate-fade-up rounded-[var(--radius)] p-4 space-y-3">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input
              id="title"
              className={`input ${fieldErrors.title ? 'border-[var(--danger)]' : ''}`}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                clearFieldError('title')
              }}
              required
            />
            {fieldErrors.title && (
              <p className="mt-1.5 text-xs font-semibold text-[var(--danger)]">{fieldErrors.title}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="date">Date</label>
              <input
                id="date"
                className={`input ${fieldErrors.date ? 'border-[var(--danger)]' : ''}`}
                type="date"
                max={today}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  clearFieldError('date')
                  setError('')
                }}
                required
              />
              {fieldErrors.date && (
                <p className="mt-1.5 text-xs font-semibold text-[var(--danger)]">{fieldErrors.date}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="duration">Minutes</label>
              <input
                id="duration"
                className={`input ${fieldErrors.duration ? 'border-[var(--danger)]' : ''}`}
                type="text"
                inputMode="numeric"
                value={duration}
                onChange={(e) => {
                  setDuration(sanitizeNumericInput(e.target.value))
                  clearFieldError('duration')
                }}
                onBlur={() => setDuration(toNumericString(duration, '0'))}
                required
              />
              {fieldErrors.duration && (
                <p className="mt-1.5 text-xs font-semibold text-[var(--danger)]">{fieldErrors.duration}</p>
              )}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="notes">Notes</label>
            <input
              id="notes"
              className="input"
              placeholder="Felt strong, shorter rest…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </section>

        <div className="flex items-center justify-between animate-fade-up">
          <h2 className="font-display text-xl font-bold">Exercises</h2>
          <div className="flex gap-2">
            {restLeft != null ? (
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-extrabold text-[var(--accent)]">
                Rest {restLeft}s
              </span>
            ) : (
              <button type="button" className="btn btn-secondary px-3 py-1.5 text-sm" onClick={startRest}>
                Rest timer
              </button>
            )}
            <button type="button" className="btn btn-accent px-3 py-1.5 text-sm" onClick={() => setPickerOpen(true)}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {fieldErrors.exercises && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-[var(--danger)]">
            {fieldErrors.exercises}
          </p>
        )}
        {fieldErrors.sets && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-[var(--danger)]">
            {fieldErrors.sets}
          </p>
        )}

        {selected.length === 0 && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={`glass flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed py-10 text-[var(--ink-muted)] ${
              fieldErrors.exercises ? 'border-[var(--danger)]' : 'border-[var(--line)]'
            }`}
          >
            <Plus size={28} />
            <span className="font-bold">Pick your first exercise</span>
          </button>
        )}

        {selected.map((ex, exIdx) => (
          <section
            key={`${ex.exerciseId}-${exIdx}`}
            className="glass animate-slide-in rounded-[var(--radius)] p-4"
            style={{ animationDelay: `${exIdx * 40}ms` }}
          >
            <div className="flex items-start gap-3">
              <ExerciseImage imageKey={ex.imageKey} muscle={ex.muscle} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{ex.exerciseName}</p>
                <p className="text-xs text-[var(--ink-muted)]">{MUSCLE_LABELS[ex.muscle]}</p>
              </div>
              <button type="button" className="btn btn-ghost p-2" onClick={() => removeExercise(exIdx)} aria-label="Remove">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 px-1 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                <span>#</span>
                <span>Reps</span>
                <span>Weight ({units})</span>
                <span />
              </div>
              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} className="grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateSet(exIdx, setIdx, { completed: !set.completed })
                      if (!set.completed) startRest()
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                      set.completed
                        ? 'bg-[var(--brand)] text-white'
                        : 'bg-white border border-[var(--line)]'
                    }`}
                  >
                    {set.completed ? <Check size={14} /> : setIdx + 1}
                  </button>
                  <input
                    className={`input py-2 ${set.reps <= 0 && fieldErrors.sets ? 'border-[var(--danger)]' : ''}`}
                    type="text"
                    inputMode="numeric"
                    value={toNumericString(set.reps, '0')}
                    onChange={(e) =>
                      updateSet(exIdx, setIdx, {
                        reps: parseNumeric(sanitizeNumericInput(e.target.value), 0),
                      })
                    }
                  />
                  <input
                    className={`input py-2 ${set.weight < 0 && fieldErrors.sets ? 'border-[var(--danger)]' : ''}`}
                    type="text"
                    inputMode="decimal"
                    value={toNumericString(set.weight, '0')}
                    onChange={(e) =>
                      updateSet(exIdx, setIdx, {
                        weight: parseNumeric(sanitizeNumericInput(e.target.value, true), 0),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-ghost p-2"
                    onClick={() => removeSet(exIdx, setIdx)}
                    aria-label="Remove set"
                    disabled={ex.sets.length <= 1}
                  >
                    <Minus size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary mt-3 w-full py-2 text-sm" onClick={() => addSet(exIdx)}>
              <Plus size={14} /> Add set
            </button>
          </section>
        ))}

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save workout'}
        </button>
      </form>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[85svh] w-full max-w-lg flex-col rounded-t-[1.5rem] bg-[var(--bg)] sm:rounded-[var(--radius)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <h3 className="font-display text-lg font-bold">Add exercise</h3>
              <button type="button" className="btn btn-ghost p-2" onClick={() => setPickerOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 px-4 py-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                <input
                  className="input pl-9"
                  placeholder="Search exercises"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {muscles.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMuscleFilter(m)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      muscleFilter === m
                        ? 'bg-[var(--brand)] text-white'
                        : 'bg-white border border-[var(--line)]'
                    }`}
                  >
                    {m === 'all' ? 'All' : MUSCLE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-6">
              {filtered.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => addExercise(ex)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left border border-[var(--line)] hover:border-[var(--brand)]"
                >
                  <ExerciseImage imageKey={ex.imageKey} muscle={ex.muscle} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{ex.name}</p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {MUSCLE_LABELS[ex.muscle]} · {ex.equipment}
                    </p>
                  </div>
                  <ChevronDown className="-rotate-90 text-[var(--ink-muted)]" size={16} />
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-[var(--ink-muted)]">No exercises found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
