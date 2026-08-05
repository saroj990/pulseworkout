import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import {
  Check,
  ChevronDown,
  CircleCheck,
  Minus,
  Pause,
  Play,
  Plus,
  Search,
  SkipForward,
  Sparkles,
  Timer,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { db, type Exercise, type MuscleGroup, type WorkoutExercise, type WorkoutSet } from '../db'
import { MUSCLE_LABELS } from '../data/exercises'
import { getExerciseDefault } from '../data/exerciseDefaults'
import { ExerciseImage } from '../components/ExerciseImage'
import { PART_WORKOUTS, WEEKDAY_FULL, getPlanDayForDate, type Weekday } from '../data/plans'
import { parseNumeric, sanitizeNumericInput, toNumericString } from '../lib/numeric'
import {
  AUTO_COMPLETE_AFTER_PROMPT_SEC,
  BETWEEN_EXERCISE_REST_SEC,
  PROMPT_GRACE_SEC,
  clearWorkoutSession,
  formatClock,
  isExerciseDone,
  loadWorkoutSession,
  saveWorkoutSession,
  sessionElapsedSec,
  type WorkoutSessionState,
} from '../lib/workoutSession'

function emptySet(reps = 0, weight = 0): WorkoutSet {
  return { reps, weight, completed: false }
}

function toWorkoutExercise(ex: Exercise, units: 'kg' | 'lbs'): WorkoutExercise {
  const def = getExerciseDefault(ex.name, ex.muscle, units)
  return {
    exerciseId: ex.id!,
    exerciseName: ex.name,
    muscle: ex.muscle,
    imageKey: ex.imageKey,
    sets: Array.from({ length: def.sets }, () => emptySet(def.reps, def.weightKg)),
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
  requireSets: boolean
}): FieldErrors {
  const errors: FieldErrors = {}

  if (!input.title.trim()) errors.title = 'Add a workout title.'

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
  } else if (input.requireSets) {
    const missingSets = input.selected.some((ex) => ex.sets.length === 0)
    if (missingSets) {
      errors.sets = 'Each exercise needs at least one set.'
    } else {
      const badReps = input.selected.some((ex) => ex.sets.some((s) => s.reps <= 0))
      if (badReps) errors.sets = 'Every set needs reps greater than 0.'
      const badWeight = input.selected.some((ex) =>
        ex.sets.some((s) => !Number.isFinite(s.weight) || s.weight < 0),
      )
      if (!errors.sets && badWeight) errors.sets = 'Weight can’t be negative.'
    }
  }

  return errors
}

export function LogWorkoutPage() {
  const { user, preferences, goals } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const units = preferences?.units ?? 'kg'
  const restSeconds = preferences?.restSeconds ?? 90
  const prefillsApplied = useRef(false)
  const completingRef = useRef(false)
  const exerciseRefs = useRef<Record<number, HTMLElement | null>>({})
  const restIntervalRef = useRef<number | null>(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const activePlan = useLiveQuery(async () => {
    if (!user?.id) return undefined
    return db.userPlans.where('userId').equals(user.id).filter((p) => p.active).first()
  }, [user?.id])

  const recentWorkouts = useLiveQuery(async () => {
    if (!user?.id) return []
    const all = await db.workouts.where('userId').equals(user.id).toArray()
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 40)
  }, [user?.id])

  const defaultDuration = String(goals?.dailyMinutes && goals.dailyMinutes > 0 ? goals.dailyMinutes : 45)

  const [title, setTitle] = useState(`Workout — ${format(new Date(), 'MMM d')}`)
  const [date, setDate] = useState(today)
  const [duration, setDuration] = useState(defaultDuration)
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<WorkoutExercise[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'all'>('all')
  const [restLeft, setRestLeft] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [session, setSession] = useState<WorkoutSessionState | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [showCompletePrompt, setShowCompletePrompt] = useState(false)

  const existingForDate = useLiveQuery(async () => {
    if (!user?.id || !date) return undefined
    const matches = await db.workouts
      .where('userId')
      .equals(user.id)
      .filter((w) => w.date === date)
      .toArray()
    return matches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  }, [user?.id, date])

  const alreadyLogged = Boolean(existingForDate) && !session
  const isToday = date === today

  const planDay = useMemo(() => {
    if (!activePlan) return undefined
    const d = new Date(`${date}T12:00:00`)
    return getPlanDayForDate(activePlan.days, d)
  }, [activePlan, date])

  const recentExerciseIds = useMemo(() => {
    const ids: number[] = []
    const seen = new Set<number>()
    for (const w of recentWorkouts ?? []) {
      for (const ex of w.exercises) {
        if (!seen.has(ex.exerciseId)) {
          seen.add(ex.exerciseId)
          ids.push(ex.exerciseId)
        }
      }
    }
    return ids
  }, [recentWorkouts])

  useEffect(() => {
    if (!user?.id) return
    const saved = loadWorkoutSession(user.id)
    if (!saved) return
    setSession(saved)
    setTitle(saved.title)
    setDate(saved.date)
    setDuration(String(saved.durationMin))
    setNotes(saved.notes)
    setSelected(saved.exercises)
    prefillsApplied.current = true
  }, [user?.id])

  useEffect(() => {
    if (!session) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [session])

  useEffect(() => {
    if (!session) return
    saveWorkoutSession({ ...session, exercises: selected, title, notes, date })
  }, [session, selected, title, notes, date])

  useEffect(() => {
    if (prefillsApplied.current || !exercises?.length || alreadyLogged || session) return

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
        setSelected(picked.map((e) => toWorkoutExercise(e, units)))
        setMuscleFilter(part)
        setDuration(defaultDuration)
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
          setSelected(picked.map((e) => toWorkoutExercise(e, units)))
          if (day.muscles.length === 1) setMuscleFilter(day.muscles[0])
          setDuration(defaultDuration)
          prefillsApplied.current = true
        }
      }
    }
  }, [exercises, activePlan, searchParams, alreadyLogged, session, units, defaultDuration])

  const filtered = useMemo(() => {
    const list = exercises ?? []
    const recentRank = new Map(recentExerciseIds.map((id, i) => [id, i]))
    return list
      .filter((ex) => {
        const q = query.trim().toLowerCase()
        const matchQ = !q || ex.name.toLowerCase().includes(q)
        const matchM = muscleFilter === 'all' || ex.muscle === muscleFilter
        return matchQ && matchM
      })
      .sort((a, b) => {
        const ar = a.id != null && recentRank.has(a.id) ? recentRank.get(a.id)! : 9999
        const br = b.id != null && recentRank.has(b.id) ? recentRank.get(b.id)! : 9999
        if (ar !== br) return ar - br
        return a.name.localeCompare(b.name)
      })
  }, [exercises, query, muscleFilter, recentExerciseIds])

  const elapsedSec = session ? sessionElapsedSec(session, now) : 0
  const targetSec = (session?.durationMin ?? parseNumeric(duration, 0)) * 60
  const promptAtSec = targetSec + PROMPT_GRACE_SEC
  const autoCompleteAtSec =
    session?.promptShownAt != null
      ? Math.floor((session.promptShownAt - session.startedAt - session.pausedMs) / 1000) +
        AUTO_COMPLETE_AFTER_PROMPT_SEC
      : promptAtSec + AUTO_COMPLETE_AFTER_PROMPT_SEC

  const isPaused = Boolean(session?.pausedAt)
  const restLeftSec =
    session?.restEndsAt != null
      ? Math.max(0, Math.ceil((session.restEndsAt - (session.pausedAt ?? now)) / 1000))
      : 0
  const resting = restLeftSec > 0

  const focusIndex = session?.focusIndex ?? 0
  const allExercisesDone = selected.length > 0 && selected.every(isExerciseDone)
  const lineProgress = targetSec > 0 ? Math.min(1, elapsedSec / targetSec) : 0

  /** True while an incomplete exercise is actively being worked (not during rest). */
  const hasActiveExercise = Boolean(
    session &&
      !resting &&
      selected[focusIndex] &&
      !isExerciseDone(selected[focusIndex]),
  )

  const displayExercise = useMemo(() => {
    if (!session || selected.length === 0) return undefined
    if (resting) return selected[focusIndex]
    const fromFocus = selected.find((ex, i) => i >= focusIndex && !isExerciseDone(ex))
    return fromFocus ?? selected.find((ex) => !isExerciseDone(ex))
  }, [session, selected, focusIndex, resting])

  const currentActivityLabel = useMemo(() => {
    if (!session) return ''
    if (allExercisesDone) return 'All exercises done — complete when ready'
    if (resting && restLeftSec > 0) {
      const next = selected[focusIndex] ?? displayExercise
      return next ? `Rest · next up: ${next.exerciseName}` : 'Rest'
    }
    if (displayExercise) return displayExercise.exerciseName
    return title
  }, [
    session,
    allExercisesDone,
    resting,
    restLeftSec,
    selected,
    focusIndex,
    displayExercise,
    title,
  ])

  const displayExerciseNumber = useMemo(() => {
    if (!displayExercise) return 0
    const idx = selected.findIndex((ex) => ex.exerciseId === displayExercise.exerciseId)
    return idx >= 0 ? idx + 1 : focusIndex + 1
  }, [displayExercise, selected, focusIndex])

  useEffect(() => {
    if (!session?.restEndsAt || session.pausedAt) return
    if (now >= session.restEndsAt) {
      setSession((prev) => (prev ? { ...prev, restEndsAt: null } : prev))
    }
  }, [session?.restEndsAt, session?.pausedAt, now])

  useEffect(() => {
    if (!session) return
    const el = exerciseRefs.current[focusIndex]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [session, focusIndex, resting])

  const persistWorkout = useCallback(async () => {
    if (!user?.id || completingRef.current) return
    completingRef.current = true
    setBusy(true)
    setError('')
    try {
      const durationMin = session?.durationMin ?? parseNumeric(duration, 0)
      const workoutDate = session?.date ?? date
      const workoutTitle = title.trim()
      const workoutNotes = notes.trim()
      const workoutExercises = selected

      const duplicate = await db.workouts
        .where('userId')
        .equals(user.id)
        .filter((w) => w.date === workoutDate)
        .first()
      if (duplicate) {
        clearWorkoutSession()
        setSession(null)
        setShowCompletePrompt(false)
        navigate(`/history/${duplicate.id}`)
        return
      }

      const nowIso = new Date().toISOString()
      const id = await db.workouts.add({
        userId: user.id,
        date: workoutDate,
        title: workoutTitle,
        notes: workoutNotes,
        durationMin: Math.max(1, Math.round(elapsedSec / 60) || durationMin),
        exercises: workoutExercises,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      clearWorkoutSession()
      setSession(null)
      setShowCompletePrompt(false)
      navigate(`/history/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete workout')
      completingRef.current = false
    } finally {
      setBusy(false)
    }
  }, [user?.id, session, duration, date, title, notes, selected, elapsedSec, navigate])

  useEffect(() => {
    if (!session || completingRef.current || isPaused) return

    if (elapsedSec >= promptAtSec && !session.promptShownAt) {
      const promptShownAt = Date.now()
      setSession((prev) => (prev ? { ...prev, promptShownAt } : prev))
      setShowCompletePrompt(true)
      return
    }

    if (session.promptShownAt && elapsedSec >= autoCompleteAtSec && !completingRef.current) {
      void persistWorkout()
    }
  }, [session, elapsedSec, promptAtSec, autoCompleteAtSec, persistWorkout, isPaused])

  function clearFieldError(key: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function applyPreset(exerciseNames: string[], presetTitle: string, muscle?: MuscleGroup) {
    if (!exercises?.length || alreadyLogged) return
    const byName = new Map(exercises.map((e) => [e.name, e]))
    const picked = exerciseNames
      .map((n) => byName.get(n))
      .filter((e): e is Exercise => Boolean(e?.id))
    if (!picked.length) {
      setError('Couldn’t load that preset — exercises missing from the library.')
      return
    }
    setTitle(presetTitle)
    setSelected(picked.map((e) => toWorkoutExercise(e, units)))
    if (muscle) setMuscleFilter(muscle)
    setMessage('Preset loaded — tweak anything before you start.')
    setError('')
    clearFieldError('exercises')
    clearFieldError('sets')
  }

  function addExercise(ex: Exercise) {
    if (alreadyLogged || !ex.id) return
    if (selected.some((s) => s.exerciseId === ex.id)) return
    setSelected((prev) => [toWorkoutExercise(ex, units), ...prev])
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
      prev.map((ex, i) => {
        if (i !== exIdx) return ex
        const last = ex.sets[ex.sets.length - 1]
        return {
          ...ex,
          sets: [...ex.sets, emptySet(last?.reps ?? 10, last?.weight ?? 0)],
        }
      }),
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
    if (alreadyLogged || session) return
    setSelected((prev) => prev.filter((_, i) => i !== exIdx))
  }

  function clearStandaloneRest() {
    if (restIntervalRef.current != null) {
      window.clearInterval(restIntervalRef.current)
      restIntervalRef.current = null
    }
    setRestLeft(null)
  }

  function startRest() {
    if (alreadyLogged || session) return
    clearStandaloneRest()
    setRestLeft(restSeconds)
    restIntervalRef.current = window.setInterval(() => {
      setRestLeft((v) => {
        if (v == null || v <= 1) {
          if (restIntervalRef.current != null) {
            window.clearInterval(restIntervalRef.current)
            restIntervalRef.current = null
          }
          return null
        }
        return v - 1
      })
    }, 1000)
  }

  function skipRest() {
    if (session?.restEndsAt != null) {
      setSession((prev) => (prev ? { ...prev, restEndsAt: null } : prev))
      return
    }
    clearStandaloneRest()
  }

  function togglePause() {
    if (!session) return
    const t = Date.now()
    if (session.pausedAt) {
      const pauseDuration = t - session.pausedAt
      setSession({
        ...session,
        pausedAt: null,
        pausedMs: session.pausedMs + pauseDuration,
        restEndsAt: session.restEndsAt != null ? session.restEndsAt + pauseDuration : null,
      })
    } else {
      setSession({ ...session, pausedAt: t })
    }
  }

  const advanceFocusFrom = useCallback(
    (doneIdx: number) => {
      setSession((prev) => {
        if (!prev) return prev
        const nextIndex = selected.findIndex((ex, i) => i > doneIdx && !isExerciseDone(ex))
        if (nextIndex >= 0) {
          return {
            ...prev,
            focusIndex: nextIndex,
            restEndsAt: Date.now() + BETWEEN_EXERCISE_REST_SEC * 1000,
          }
        }
        if (prev.focusIndex === doneIdx && prev.restEndsAt == null) return prev
        return { ...prev, focusIndex: doneIdx, restEndsAt: null }
      })
    },
    [selected],
  )

  // If the focused exercise becomes done (e.g. all sets ticked), move focus to the next
  useEffect(() => {
    if (!session || resting || isPaused) return
    const focused = selected[session.focusIndex]
    if (!focused || !isExerciseDone(focused)) return
    const hasNext = selected.some((ex, i) => i > session.focusIndex && !isExerciseDone(ex))
    if (!hasNext) return
    advanceFocusFrom(session.focusIndex)
  }, [selected, session, resting, isPaused, advanceFocusFrom])

  function markExerciseDone(exIdx: number) {
    if (!session || resting || isPaused) return
    if (exIdx !== session.focusIndex) return

    if (!isExerciseDone(selected[exIdx])) {
      setSelected((prev) =>
        prev.map((ex, i) =>
          i === exIdx
            ? { ...ex, sets: ex.sets.map((s) => ({ ...s, completed: true })) }
            : ex,
        ),
      )
    }
    advanceFocusFrom(exIdx)
  }

  /** Pick an exercise as the current / next one when nothing is actively in progress. */
  function setAsCurrent(exIdx: number) {
    if (!session || hasActiveExercise || isPaused) return
    if (isExerciseDone(selected[exIdx])) return
    setSession((prev) =>
      prev
        ? {
            ...prev,
            focusIndex: exIdx,
            // Keep mandatory rest if it's already running; otherwise start this exercise now
            restEndsAt: resting && prev.restEndsAt ? prev.restEndsAt : null,
          }
        : prev,
    )
  }

  async function onSaveToPlan(e?: FormEvent) {
    e?.preventDefault()
    if (!user?.id || alreadyLogged || session) return

    const errors = validateWorkout({
      title,
      date,
      duration,
      selected,
      requireSets: false,
    })
    delete errors.duration
    setFieldErrors(errors)
    if (errors.title || errors.date || errors.exercises) {
      setError('Add a title and at least one exercise to save to your plan.')
      return
    }

    setBusy(true)
    setError('')
    setMessage('')
    try {
      const weekday = new Date(`${date}T12:00:00`).getDay() as Weekday
      const muscles = [...new Set(selected.map((s) => s.muscle))]
      const exerciseNames = selected.map((s) => s.exerciseName)
      const dayPatch = {
        weekday,
        muscles,
        title: title.trim(),
        exerciseNames,
      }

      if (activePlan?.id) {
        const days = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((wd) => {
          const existing = activePlan.days.find((d) => d.weekday === wd)
          if (wd === weekday) return dayPatch
          return (
            existing ?? {
              weekday: wd,
              muscles: [],
              title: 'Rest',
              exerciseNames: [],
            }
          )
        })
        await db.userPlans.update(activePlan.id, {
          days,
          updatedAt: new Date().toISOString(),
        })
      } else {
        const days = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((wd) =>
          wd === weekday
            ? dayPatch
            : { weekday: wd, muscles: [], title: 'Rest', exerciseNames: [] },
        )
        await db.userPlans.add({
          userId: user.id,
          templateId: 'custom',
          name: 'My plan',
          days,
          active: true,
          updatedAt: new Date().toISOString(),
        })
      }
      setMessage(`Saved to plan for ${WEEKDAY_FULL[weekday]}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save to plan')
    } finally {
      setBusy(false)
    }
  }

  function onStartWorkout() {
    if (!user?.id || alreadyLogged || session) return
    const errors = validateWorkout({
      title,
      date,
      duration,
      selected,
      requireSets: true,
    })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setError('Fix the highlighted fields before starting.')
      return
    }

    const next: WorkoutSessionState = {
      userId: user.id,
      startedAt: Date.now(),
      durationMin: parseNumeric(duration, 0),
      title: title.trim(),
      date,
      notes: notes.trim(),
      exercises: selected,
      focusIndex: 0,
      restEndsAt: null,
      pausedAt: null,
      pausedMs: 0,
      promptShownAt: null,
      promptDismissed: false,
    }
    setSession(next)
    saveWorkoutSession(next)
    setError('')
    setMessage('')
    setShowCompletePrompt(false)
  }

  async function onCompleteManual() {
    const errors = validateWorkout({
      title,
      date,
      duration,
      selected,
      requireSets: true,
    })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setError('Fix sets before completing.')
      setShowCompletePrompt(false)
      return
    }
    await persistWorkout()
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
              <button type="button" className="btn btn-ghost w-full" onClick={() => setDate(today)}>
                Switch to today
              </button>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-extrabold">
          {session ? title : 'Log workout'}
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {session
            ? 'Mark each exercise done — 1 min rest between them (skippable).'
            : 'Build a session, save it to your plan, or start the timer.'}
        </p>
      </header>

      {session && (
        <section className="glass animate-fade-up sticky top-0 z-20 rounded-[var(--radius)] p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <Timer size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-extrabold tabular-nums tracking-tight">
                  {formatClock(elapsedSec)}
                </span>
                <span className="text-xs font-semibold text-[var(--ink-muted)]">
                  / {session.durationMin}m
                  {isPaused ? ' · paused' : ''}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                <div
                  className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-500"
                  style={{ width: `${lineProgress * 100}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary shrink-0 px-3 py-2"
              onClick={togglePause}
              aria-label={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white px-3 py-2.5">
            {resting && restLeftSec > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[var(--accent)]">
                      Rest
                    </p>
                    <p className="truncate text-sm font-bold">{currentActivityLabel}</p>
                  </div>
                  <span className="shrink-0 font-display text-xl font-extrabold tabular-nums text-[var(--accent)]">
                    {formatClock(restLeftSec)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary w-full py-2 text-sm"
                  onClick={skipRest}
                >
                  <SkipForward size={14} /> Skip rest
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                  {allExercisesDone ? 'Status' : 'Now doing'}
                </p>
                <p className="truncate font-bold">{currentActivityLabel}</p>
                {!allExercisesDone && displayExercise && !resting && (
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                    Exercise {displayExerciseNumber} of {selected.length} ·{' '}
                    {MUSCLE_LABELS[displayExercise.muscle]}
                  </p>
                )}
              </div>
            )}
          </div>

          {(allExercisesDone || elapsedSec >= targetSec) && (
            <button
              type="button"
              className="btn btn-primary mt-3 w-full"
              onClick={() => void onCompleteManual()}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Complete workout'}
            </button>
          )}
        </section>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (session) void onCompleteManual()
          else void onSaveToPlan(e)
        }}
        className="space-y-4"
        noValidate
      >
        {!session && (
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
            <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="min-w-0">
                <label className="label" htmlFor="date">Date</label>
                <input
                  id="date"
                  className={`input input-date-compact ${fieldErrors.date ? 'border-[var(--danger)]' : ''}`}
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
              </div>
              <div className="min-w-0">
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
                  onBlur={() => setDuration(toNumericString(duration, defaultDuration))}
                  required
                />
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
        )}

        {!session && (
          <section className="glass animate-fade-up rounded-[var(--radius)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--brand)]" />
              <h2 className="font-display text-base font-bold">Presets</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {planDay && planDay.muscles.length > 0 && (
                <button
                  type="button"
                  className="btn btn-accent px-3 py-1.5 text-xs"
                  onClick={() => applyPreset(planDay.exerciseNames, planDay.title, planDay.muscles[0])}
                >
                  Today’s plan · {planDay.title}
                </button>
              )}
              {(Object.keys(PART_WORKOUTS) as MuscleGroup[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-bold hover:border-[var(--brand)]"
                  onClick={() => applyPreset(PART_WORKOUTS[m].exerciseNames, PART_WORKOUTS[m].title, m)}
                >
                  {PART_WORKOUTS[m].title}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center justify-between animate-fade-up">
          <h2 className="font-display text-xl font-bold">Exercises</h2>
          {!session && (
            <div className="flex gap-2">
              {restLeft != null ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-extrabold text-[var(--accent)]"
                  onClick={skipRest}
                >
                  Rest {restLeft}s · Skip
                </button>
              ) : (
                <button type="button" className="btn btn-secondary px-3 py-1.5 text-sm" onClick={startRest}>
                  Rest timer
                </button>
              )}
              <button
                type="button"
                className="btn btn-accent px-3 py-1.5 text-sm"
                onClick={() => setPickerOpen(true)}
              >
                <Plus size={16} /> Add
              </button>
            </div>
          )}
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

        {selected.map((ex, exIdx) => {
          const done = isExerciseDone(ex)
          const isFocus = Boolean(session) && focusIndex === exIdx && !done && !resting
          const isNextUp = Boolean(session) && resting && focusIndex === exIdx && !done
          const isLocked =
            Boolean(session) && (resting || isPaused || (exIdx !== focusIndex && !done))
          const dimmed = Boolean(session) && !isFocus && !isNextUp && !done
          const canSetCurrent =
            Boolean(session) && !done && !isFocus && !isNextUp && !hasActiveExercise && !isPaused

          return (
            <section
              key={`${ex.exerciseId}-${exIdx}`}
              ref={(node) => {
                exerciseRefs.current[exIdx] = node
              }}
              className={`animate-slide-in rounded-[var(--radius)] p-4 transition ${
                isFocus || isNextUp
                  ? 'glass ring-2 ring-[var(--brand)] shadow-[0_8px_28px_rgba(15,118,110,0.18)]'
                  : done
                    ? 'glass opacity-70'
                    : dimmed
                      ? 'glass opacity-50'
                      : 'glass'
              }`}
              style={{ animationDelay: `${exIdx * 40}ms` }}
            >
              <div className="flex items-start gap-3">
                <ExerciseImage imageKey={ex.imageKey} muscle={ex.muscle} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold">{ex.exerciseName}</p>
                    {done && (
                      <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--brand)]">
                        Done
                      </span>
                    )}
                    {isFocus && !resting && (
                      <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--accent)]">
                        Active
                      </span>
                    )}
                    {isNextUp && (
                      <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--accent)]">
                        Next
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--ink-muted)]">{MUSCLE_LABELS[ex.muscle]}</p>
                </div>
                {!session && (
                  <button
                    type="button"
                    className="btn btn-ghost p-2"
                    onClick={() => removeExercise(exIdx)}
                    aria-label="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {(!session || isFocus || isNextUp || done) && (
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
                        disabled={Boolean(session) && (resting || isPaused || !isFocus)}
                        onClick={() => {
                          updateSet(exIdx, setIdx, { completed: !set.completed })
                          if (!session && !set.completed) startRest()
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
                        disabled={Boolean(session) && !isFocus}
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
                        disabled={Boolean(session) && !isFocus}
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
                        disabled={ex.sets.length <= 1 || (Boolean(session) && !isFocus)}
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!session && (
                <button
                  type="button"
                  className="btn btn-secondary mt-3 w-full py-2 text-sm"
                  onClick={() => addSet(exIdx)}
                >
                  <Plus size={14} /> Add set
                </button>
              )}

              {session && isFocus && !done && (
                <button
                  type="button"
                  className="btn btn-primary mt-3 w-full"
                  disabled={isLocked}
                  onClick={() => markExerciseDone(exIdx)}
                >
                  <Check size={16} />
                  {isPaused ? 'Resume timer to continue' : 'Mark exercise done'}
                </button>
              )}

              {session && isNextUp && (
                <div className="mt-3 space-y-2">
                  <p className="text-center text-xs font-semibold text-[var(--accent)]">
                    Rest {formatClock(restLeftSec)} — then this exercise starts
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary w-full py-2 text-sm"
                    onClick={skipRest}
                  >
                    <SkipForward size={14} /> Skip rest
                  </button>
                </div>
              )}

              {session && !done && !isFocus && !isNextUp && (
                <button
                  type="button"
                  className="btn btn-secondary mt-3 w-full py-2 text-sm"
                  disabled={!canSetCurrent}
                  onClick={() => setAsCurrent(exIdx)}
                  title={
                    hasActiveExercise
                      ? 'Finish or mark the active exercise done first'
                      : isPaused
                        ? 'Resume the timer first'
                        : 'Make this the current exercise'
                  }
                >
                  Set as current
                </button>
              )}
            </section>
          )
        })}

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-[var(--danger)]">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand)]">
            {message}
          </p>
        )}

        {!session ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="submit" className="btn btn-secondary w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Save to plan'}
            </button>
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={busy}
              onClick={onStartWorkout}
            >
              <Play size={16} /> Start workout
            </button>
          </div>
        ) : (
          !allExercisesDone && (
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={() => void onCompleteManual()}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'End & save early'}
            </button>
          )
        )}
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
                  className="input input-with-icon"
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
            </div>
          </div>
        </div>
      )}

      {showCompletePrompt && session && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-5">
          <div className="w-full max-w-sm rounded-[var(--radius)] bg-white p-5 shadow-xl animate-fade-up">
            <h3 className="font-display text-xl font-bold">Wrap up this workout?</h3>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              You’re past your {session.durationMin}-minute target (plus a 10‑minute buffer). Confirm
              to save now. If there’s no confirmation, it’ll complete automatically in about 20
              minutes.
            </p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={busy}
                onClick={() => void onCompleteManual()}
              >
                {busy ? 'Saving…' : 'Yes, complete now'}
              </button>
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => {
                  setShowCompletePrompt(false)
                  setSession((prev) => (prev ? { ...prev, promptDismissed: true } : prev))
                }}
              >
                Not yet — keep going
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
