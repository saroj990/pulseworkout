import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import {
  CalendarDays,
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
} from 'lucide-react'
import { SaveWorkoutToPlanModal } from '../components/SaveWorkoutToPlanModal'
import { filterExercisesForBrowse } from '../lib/exerciseSearch'
import { upsertActivePlanDay } from '../lib/planStorage'
import { useAuth } from '../context/AuthContext'
import { db, type Exercise, type MuscleGroup, type WorkoutExercise, type WorkoutSet } from '../db'
import { MUSCLE_LABELS } from '../data/exercises'
import { getExerciseDefault } from '../data/exerciseDefaults'
import { ExerciseImage } from '../components/ExerciseImage'
import {
  PART_WORKOUTS,
  WEEKDAY_FULL,
  WEEKDAY_LABELS,
  getPlanDayForWeekday,
  templateWorkoutPresets,
  type Weekday,
} from '../data/plans'
import {
  readLogPlanWeekdayOverride,
  saveLogPlanWeekdayOverride,
  clearLogPlanWeekdayOverride,
} from '../lib/logPlanOverride'
import { DEFAULT_DAILY_MINUTES, positiveOrDefault } from '../data/goals'
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
  const restSeconds =
    preferences?.restSeconds && preferences.restSeconds > 0
      ? preferences.restSeconds
      : BETWEEN_EXERCISE_REST_SEC
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

  const defaultDuration = String(positiveOrDefault(goals?.dailyMinutes, DEFAULT_DAILY_MINUTES))

  const [title, setTitle] = useState(`Workout — ${format(new Date(), 'MMM d')}`)
  const [date, setDate] = useState(today)
  const [duration, setDuration] = useState(defaultDuration)
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<WorkoutExercise[]>([])
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
  const [presetMode, setPresetMode] = useState<'replace' | 'append'>('replace')
  const [showMoreWorkouts, setShowMoreWorkouts] = useState(false)
  const [savePresetModal, setSavePresetModal] = useState<{
    title: string
    exerciseNames: string[]
    muscles: MuscleGroup[]
  } | null>(null)
  type LogWizardStep = 'details' | 'template' | 'exercises'
  const [logStep, setLogStep] = useState<LogWizardStep>('details')
  const [pickListOpen, setPickListOpen] = useState(false)
  const [showPickNotes, setShowPickNotes] = useState(false)
  const [showMuscleFilters, setShowMuscleFilters] = useState(false)

  useEffect(() => {
    if (logStep !== 'exercises') {
      setPickListOpen(false)
      setShowPickNotes(false)
      setShowMuscleFilters(false)
    }
  }, [logStep])

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

  const calendarWeekday = useMemo(() => {
    const d = new Date(`${date}T12:00:00`)
    return d.getDay() as Weekday
  }, [date])

  const [planWeekdayOverride, setPlanWeekdayOverride] = useState<Weekday | null>(null)

  useEffect(() => {
    if (!user?.id) return
    setPlanWeekdayOverride(readLogPlanWeekdayOverride(user.id, date))
  }, [user?.id, date])

  const effectivePlanWeekday = planWeekdayOverride ?? calendarWeekday

  const planDay = useMemo(() => {
    if (!activePlan) return undefined
    return getPlanDayForWeekday(activePlan.days, effectivePlanWeekday)
  }, [activePlan, effectivePlanWeekday])

  const templatePresets = useMemo(() => templateWorkoutPresets(), [])

  const weekdays = useMemo(() => [0, 1, 2, 3, 4, 5, 6] as Weekday[], [])

  function selectPlanWeekday(wd: Weekday) {
    setPlanWeekdayOverride(wd)
    if (user?.id) saveLogPlanWeekdayOverride(user.id, date, wd)
  }

  function resetPlanWeekdayToCalendar() {
    setPlanWeekdayOverride(null)
    if (user?.id) clearLogPlanWeekdayOverride(user.id, date)
  }

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
    setLogStep('exercises')
  }, [user?.id])

  // Keep a stable tick while a session is open — don't reset the interval on every session field change
  const sessionActive = Boolean(session)
  useEffect(() => {
    if (!sessionActive) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [sessionActive])

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
        setLogStep('exercises')
      }
      return
    }

    if (fromPlan && activePlan) {
      const wdParam = searchParams.get('weekday')
      let wd = calendarWeekday
      if (wdParam != null) {
        const n = Number(wdParam)
        if (n >= 0 && n <= 6) wd = n as Weekday
      } else if (user?.id) {
        const stored = readLogPlanWeekdayOverride(user.id, date)
        if (stored != null) wd = stored
      }
      const day = getPlanDayForWeekday(activePlan.days, wd)
      if (day.muscles.length > 0) {
        const picked = day.exerciseNames
          .map((n) => byName.get(n))
          .filter((e): e is Exercise => Boolean(e?.id))
        if (picked.length) {
          setTitle(day.title)
          setSelected(picked.map((e) => toWorkoutExercise(e, units)))
          if (day.muscles.length === 1) setMuscleFilter(day.muscles[0])
          setDuration(defaultDuration)
          setPlanWeekdayOverride(wd)
          if (user?.id) saveLogPlanWeekdayOverride(user.id, date, wd)
          prefillsApplied.current = true
          setLogStep('exercises')
        }
      }
    }
  }, [
    exercises,
    activePlan,
    searchParams,
    alreadyLogged,
    session,
    units,
    defaultDuration,
    calendarWeekday,
    date,
    user?.id,
  ])

  const isPickStep = !session && logStep === 'exercises'

  const browseExercises = useMemo(
    () =>
      filterExercisesForBrowse(exercises ?? [], query, muscleFilter, recentExerciseIds, {
        idleLimit: isPickStep ? 5 : 8,
        searchLimit: 40,
      }),
    [exercises, query, muscleFilter, recentExerciseIds, isPickStep],
  )

  const elapsedSec = session ? sessionElapsedSec(session, now) : 0
  const targetSec = (session?.durationMin ?? parseNumeric(duration, 0)) * 60
  const promptAtSec = targetSec + PROMPT_GRACE_SEC
  const autoCompleteAtSec =
    session?.promptShownAt != null
      ? Math.floor((session.promptShownAt - session.startedAt - session.pausedMs) / 1000) +
        AUTO_COMPLETE_AFTER_PROMPT_SEC
      : promptAtSec + AUTO_COMPLETE_AFTER_PROMPT_SEC

  const isPaused = Boolean(session?.pausedAt)
  // Use live clock (and floor) so remaining time only counts down — never inflates from a stale `now`
  const restLeftSec = useMemo(() => {
    if (session?.restEndsAt == null) return 0
    const reference = session.pausedAt ?? now
    return Math.max(0, Math.floor((session.restEndsAt - reference) / 1000))
  }, [session?.restEndsAt, session?.pausedAt, now])
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
      const focused = selected[focusIndex]
      // Between exercises: next up is incomplete focused exercise after finishing the previous
      // Between sets: focused exercise still has incomplete sets
      if (focused && !isExerciseDone(focused)) {
        return `Rest · ${focused.exerciseName}`
      }
      const next = focused ?? displayExercise
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

  function openSavePresetToPlan(
    title: string,
    exerciseNames: string[],
    muscles: MuscleGroup[],
  ) {
    setSavePresetModal({ title, exerciseNames, muscles })
    setError('')
  }

  async function confirmSavePresetToPlan(weekday: Weekday) {
    if (!user?.id || !savePresetModal) return
    setBusy(true)
    setError('')
    try {
      await upsertActivePlanDay(user.id, weekday, {
        title: savePresetModal.title,
        muscles: savePresetModal.muscles,
        exerciseNames: savePresetModal.exerciseNames,
      })
      setMessage(`Saved “${savePresetModal.title}” to ${WEEKDAY_FULL[weekday]}.`)
      setSavePresetModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save to plan')
    } finally {
      setBusy(false)
    }
  }

  function renderWorkoutPickerRow(
    key: string,
    label: string,
    exerciseNames: string[],
    muscles: MuscleGroup[],
    presetTitle?: string,
  ) {
    const title = presetTitle ?? label
    return (
      <div
        key={key}
        className="flex items-stretch gap-0.5 rounded-lg border border-[var(--line)] bg-white overflow-hidden"
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-2.5 text-left text-xs font-semibold hover:bg-[var(--brand-soft)]/40"
          onClick={() => applyPreset(exerciseNames, title, muscles[0])}
        >
          <span className="truncate">{label}</span>
          <span className="shrink-0 text-[var(--ink-muted)]">{exerciseNames.length}</span>
        </button>
        <button
          type="button"
          className="shrink-0 border-l border-[var(--line)] px-2.5 text-[var(--brand)] hover:bg-[var(--brand-soft)]"
          aria-label={`Save ${label} to plan`}
          onClick={() => openSavePresetToPlan(title, exerciseNames, muscles)}
        >
          <CalendarDays size={16} />
        </button>
      </div>
    )
  }

  function applyPreset(
    exerciseNames: string[],
    presetTitle: string,
    muscle?: MuscleGroup,
    mode?: 'replace' | 'append',
  ) {
    if (!exercises?.length || alreadyLogged) return
    const byName = new Map(exercises.map((e) => [e.name, e]))
    const picked = exerciseNames
      .map((n) => byName.get(n))
      .filter((e): e is Exercise => Boolean(e?.id))
    if (!picked.length) {
      setError('Couldn’t load that preset — exercises missing from the library.')
      return
    }
    const action = mode ?? presetMode
    if (action === 'append') {
      const existingIds = new Set(selected.map((s) => s.exerciseId))
      const newRows = picked
        .filter((e) => !existingIds.has(e.id!))
        .map((e) => toWorkoutExercise(e, units))
      if (!newRows.length) {
        setMessage('Those exercises are already in your session.')
        setError('')
        return
      }
      setSelected((prev) => [...prev, ...newRows])
      setMessage(`Added ${newRows.length} from “${presetTitle}”. Mix and match, then start when ready.`)
      if (logStep === 'template') setLogStep('exercises')
    } else {
      setTitle(presetTitle)
      setSelected(picked.map((e) => toWorkoutExercise(e, units)))
      setMessage('Workout loaded — add more from any plan or start the timer.')
      if (!session && logStep === 'template') setLogStep('exercises')
    }
    if (muscle) setMuscleFilter(muscle)
    setError('')
    clearFieldError('exercises')
    clearFieldError('sets')
  }

  function continueFromDetails() {
    const errors = validateWorkout({
      title,
      date,
      duration,
      selected: [],
      requireSets: false,
    })
    delete errors.exercises
    delete errors.sets
    setFieldErrors(errors)
    if (errors.title || errors.date || errors.duration) {
      setError('Fix the highlighted fields to continue.')
      return
    }
    setError('')
    setLogStep('template')
  }

  function renderWizardSteps() {
    const steps: { id: LogWizardStep; label: string; n: number }[] = [
      { id: 'details', label: 'Details', n: 1 },
      { id: 'template', label: 'Template', n: 2 },
      { id: 'exercises', label: 'Exercises', n: 3 },
    ]
    const current = logStep === 'details' ? 1 : logStep === 'template' ? 2 : 3
    return (
      <ol className="flex items-center gap-1 sm:gap-2" aria-label="Log workout steps">
        {steps.map((s) => {
          const done = s.n < current
          const active = s.n === current
          return (
            <li
              key={s.id}
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-2 py-1.5 text-[0.65rem] font-bold sm:text-xs ${
                active
                  ? 'bg-[var(--brand)] text-white'
                  : done
                    ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                    : 'bg-white border border-[var(--line)] text-[var(--ink-muted)]'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6rem] ${
                  active ? 'bg-white/20' : ''
                }`}
              >
                {s.n}
              </span>
              <span className="truncate">{s.label}</span>
            </li>
          )
        })}
      </ol>
    )
  }

  function renderExerciseBrowser(className = '', compact = false) {
    const q = query.trim()
    const picked = new Set(selected.map((s) => s.exerciseId))
    return (
      <div className={`flex min-h-0 flex-col gap-2 ${className}`}>
        <div className="relative shrink-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            className={`input input-with-icon ${compact ? 'text-base py-3' : ''}`}
            placeholder="Search exercises (e.g. bench dumbbell chest)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search exercises"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        {compact ? (
          <div className="flex shrink-0 items-center justify-between gap-2">
            <p className="text-[0.65rem] font-semibold text-[var(--ink-muted)]">
              {q
                ? `${browseExercises.length} match${browseExercises.length === 1 ? '' : 'es'}`
                : 'Recent — type to search all'}
            </p>
            <button
              type="button"
              className="text-[0.65rem] font-bold text-[var(--brand)]"
              onClick={() => setShowMuscleFilters((v) => !v)}
            >
              {showMuscleFilters ? 'Hide filters' : 'Muscle filter'}
            </button>
          </div>
        ) : null}
        {(showMuscleFilters || !compact) && (
          <div className="flex shrink-0 gap-2 overflow-x-auto pb-0.5">
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
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain -mx-0.5 px-0.5">
          {browseExercises.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--ink-muted)]">
              {q ? 'No exercises match — try fewer or different words.' : 'No exercises in library yet.'}
            </p>
          ) : (
            <ul className="space-y-1 pb-1">
              {browseExercises.map((ex) => {
                const added = ex.id != null && picked.has(ex.id)
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => addExercise(ex)}
                      disabled={added}
                      className={`flex w-full items-center gap-2 rounded-lg bg-white text-left border border-[var(--line)] hover:border-[var(--brand)] disabled:opacity-55 ${
                        compact ? 'px-2.5 py-2' : 'gap-2.5 rounded-xl p-2.5'
                      }`}
                    >
                      {!compact && (
                        <ExerciseImage imageKey={ex.imageKey} muscle={ex.muscle} size="sm" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{ex.name}</p>
                        <p className="truncate text-[0.65rem] text-[var(--ink-muted)]">
                          {MUSCLE_LABELS[ex.muscle]} · {ex.equipment}
                        </p>
                      </div>
                      {added ? (
                        <Check size={16} className="shrink-0 text-[var(--brand)]" />
                      ) : (
                        <Plus size={16} className="shrink-0 text-[var(--brand)]" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    )
  }

  function addExercise(ex: Exercise) {
    if (alreadyLogged || !ex.id) return
    if (selected.some((s) => s.exerciseId === ex.id)) return
    setSelected((prev) => [toWorkoutExercise(ex, units), ...prev])
    clearFieldError('exercises')
    clearFieldError('sets')
  }

  function updateSet(exIdx: number, setIdx: number, patch: Partial<WorkoutSet>) {
    if (alreadyLogged) return
    // Completing sets is only allowed after Start workout
    if (patch.completed !== undefined && !session) return
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

  /** Start / restart a countdown that can only decrease (wall-clock based). */
  function startRest(durationSec: number = restSeconds) {
    if (alreadyLogged) return
    const seconds = durationSec > 0 ? durationSec : BETWEEN_EXERCISE_REST_SEC

    // During a live session, use session.restEndsAt (shared rest banner)
    if (session) {
      const endsAt = Date.now() + seconds * 1000
      setSession((prev) => (prev ? { ...prev, restEndsAt: endsAt } : prev))
      setNow(Date.now())
      return
    }

    clearStandaloneRest()
    const endsAt = Date.now() + seconds * 1000
    setRestLeft(seconds)
    restIntervalRef.current = window.setInterval(() => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
      if (left <= 0) {
        clearStandaloneRest()
      } else {
        setRestLeft(left)
      }
    }, 250)
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
        // Shift rest deadline by the paused duration so remaining time stays the same
        restEndsAt: session.restEndsAt != null ? session.restEndsAt + pauseDuration : null,
      })
      setNow(t)
    } else {
      setSession({ ...session, pausedAt: t })
      setNow(t)
    }
  }

  const advanceFocusFrom = useCallback(
    (doneIdx: number) => {
      setSession((prev) => {
        if (!prev) return prev
        const nextIndex = selected.findIndex((ex, i) => i > doneIdx && !isExerciseDone(ex))
        if (nextIndex >= 0) {
          const alreadyResting = prev.restEndsAt != null && prev.restEndsAt > Date.now()
          return {
            ...prev,
            focusIndex: nextIndex,
            // Don't push the deadline forward if a rest is already running
            restEndsAt: alreadyResting
              ? prev.restEndsAt
              : Date.now() + BETWEEN_EXERCISE_REST_SEC * 1000,
          }
        }
        if (prev.focusIndex === doneIdx && prev.restEndsAt == null) return prev
        return { ...prev, focusIndex: doneIdx, restEndsAt: null }
      })
      setNow(Date.now())
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
  }, [selected, session?.focusIndex, resting, isPaused, advanceFocusFrom, session])

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
      const muscles = [...new Set(selected.map((s) => s.muscle))]
      const exerciseNames = selected.map((s) => s.exerciseName)
      await upsertActivePlanDay(user.id, effectivePlanWeekday, {
        title: title.trim(),
        muscles,
        exerciseNames,
      })
      setMessage(`Saved to plan for ${WEEKDAY_FULL[effectivePlanWeekday]}.`)
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
    <div className="flex min-h-0 flex-col gap-4 sm:gap-5">
      <header className="animate-fade-up shrink-0">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
          {session ? title : 'Log workout'}
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {session
            ? 'Mark each exercise done — 1 min rest between them (skippable).'
            : logStep === 'details'
              ? 'Step 1 — set the basics for this session.'
              : logStep === 'template'
                ? 'Step 2 — load a template or skip to pick exercises yourself.'
                : 'Step 3 — search and add exercises, then start.'}
        </p>
        {!session && <div className="mt-3">{renderWizardSteps()}</div>}
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
        className="flex min-h-0 flex-col gap-4"
        noValidate
      >
        {!session && logStep === 'details' && (
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
            <button type="button" className="btn btn-primary w-full" onClick={continueFromDetails}>
              Continue
            </button>
          </section>
        )}

        {!session && logStep === 'template' && (
          <>
          <section className="glass animate-fade-up flex min-h-0 flex-col overflow-hidden rounded-[var(--radius)]">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-2 max-h-[min(42dvh,22rem)] sm:max-h-[min(58dvh,30rem)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--brand)]" />
                <h2 className="font-display text-base font-bold">Workouts</h2>
              </div>
              <div
                className="inline-flex rounded-full border border-[var(--line)] bg-white p-0.5 text-[0.65rem] font-bold"
                role="group"
                aria-label="Preset load mode"
              >
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-1 ${
                    presetMode === 'replace' ? 'bg-[var(--brand)] text-white' : 'text-[var(--ink-muted)]'
                  }`}
                  onClick={() => setPresetMode('replace')}
                >
                  Replace
                </button>
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-1 ${
                    presetMode === 'append' ? 'bg-[var(--brand)] text-white' : 'text-[var(--ink-muted)]'
                  }`}
                  onClick={() => setPresetMode('append')}
                >
                  Add
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Pick any split — not limited to your weekly plan. Use <span className="font-bold">Add</span> to
              mix exercises from different workouts, then start the timer.
            </p>

            {activePlan && (
              <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">
                    {activePlan.name}
                  </p>
                  {planWeekdayOverride != null && planWeekdayOverride !== calendarWeekday && (
                    <button
                      type="button"
                      className="text-[0.65rem] font-bold text-[var(--ink-muted)] underline"
                      onClick={resetPlanWeekdayToCalendar}
                    >
                      Use calendar ({WEEKDAY_LABELS[calendarWeekday]})
                    </button>
                  )}
                </div>
                <p className="text-xs text-[var(--ink-muted)]">
                  Which plan day for{' '}
                  {format(new Date(`${date}T12:00:00`), 'EEE, MMM d')}?
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
                  {weekdays.map((wd) => {
                    const day = getPlanDayForWeekday(activePlan.days, wd)
                    const isRest = day.muscles.length === 0
                    const selected = effectivePlanWeekday === wd
                    return (
                      <button
                        key={wd}
                        type="button"
                        title={day.title}
                        className={`shrink-0 rounded-xl px-2.5 py-2 text-center text-[0.65rem] font-bold leading-tight transition ${
                          selected
                            ? 'bg-[var(--brand)] text-white shadow-sm'
                            : isRest
                              ? 'border border-dashed border-[var(--line)] bg-[var(--bg)] text-[var(--ink-muted)]'
                              : 'border border-[var(--line)] bg-white hover:border-[var(--brand)]'
                        }`}
                        onClick={() => selectPlanWeekday(wd)}
                      >
                        <span className="block">{WEEKDAY_LABELS[wd]}</span>
                        <span className={`block mt-0.5 font-semibold ${selected ? 'text-white/90' : ''}`}>
                          {isRest ? 'Rest' : day.title}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {planDay && planDay.muscles.length > 0 ? (
                  <div className="space-y-2">
                    {renderWorkoutPickerRow(
                      `plan-${effectivePlanWeekday}`,
                      `${planDay.title} (your plan)`,
                      planDay.exerciseNames,
                      planDay.muscles,
                      planDay.title,
                    )}
                    <button
                      type="button"
                      className="btn btn-accent w-full py-2 text-sm"
                      onClick={() =>
                        applyPreset(planDay.exerciseNames, planDay.title, planDay.muscles[0])
                      }
                    >
                      {presetMode === 'append' ? 'Add' : 'Load'} all · {planDay.exerciseNames.length}{' '}
                      exercises
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--ink-muted)]">
                    Rest day selected — choose another day or pick a workout below.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Body-part workouts
              </p>
              <div className="space-y-1.5">
                {(Object.keys(PART_WORKOUTS) as MuscleGroup[]).map((m) =>
                  renderWorkoutPickerRow(
                    `part-${m}`,
                    PART_WORKOUTS[m].title,
                    PART_WORKOUTS[m].exerciseNames,
                    [m],
                  ),
                )}
              </div>
            </div>

            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-left text-sm font-bold"
                onClick={() => setShowMoreWorkouts((v) => !v)}
                aria-expanded={showMoreWorkouts}
              >
                Other plan templates
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-[var(--ink-muted)] transition ${showMoreWorkouts ? 'rotate-180' : ''}`}
                />
              </button>
              {showMoreWorkouts && (
                <div className="mt-2 max-h-60 space-y-1.5 overflow-y-auto">
                  {templatePresets.map((opt) =>
                    renderWorkoutPickerRow(
                      opt.id,
                      opt.label,
                      opt.exerciseNames,
                      opt.muscles,
                      opt.label,
                    ),
                  )}
                </div>
              )}
            </div>
            </div>
          </section>
          <div className="fixed inset-x-0 z-20 grid max-w-[34rem] gap-2 border-t border-[var(--line)] bg-[var(--bg)]/98 px-[var(--page-pad)] py-3 backdrop-blur bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 sm:static sm:inset-auto sm:translate-x-0 sm:grid-cols-2 sm:border-0 sm:bg-transparent sm:p-0 sm:pt-2">
            <button type="button" className="btn btn-secondary w-full" onClick={() => setLogStep('details')}>
              Back
            </button>
            <button type="button" className="btn btn-primary w-full" onClick={() => setLogStep('exercises')}>
              Skip — pick exercises
            </button>
          </div>
          <div className="h-[5.5rem] shrink-0 sm:hidden" aria-hidden />
          </>
        )}

        {!session && logStep === 'exercises' && (
          <>
            <section className="glass shrink-0 rounded-[var(--radius)] px-3 py-2 sm:p-3 sm:space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <p className="min-w-0 flex-1 truncate font-bold">{title}</p>
                <button
                  type="button"
                  className="shrink-0 text-xs font-bold text-[var(--brand)]"
                  onClick={() => setLogStep('details')}
                >
                  Edit
                </button>
              </div>
              <p className="text-[0.65rem] text-[var(--ink-muted)] sm:text-xs">
                {format(new Date(`${date}T12:00:00`), 'EEE, MMM d')} · {duration} min
                <span className="hidden sm:inline">
                  {' '}
                  ·{' '}
                  <button
                    type="button"
                    className="font-bold text-[var(--brand)]"
                    onClick={() => setLogStep('template')}
                  >
                    Templates
                  </button>
                </span>
              </p>
              <div className="mt-2 hidden sm:block">
                <label className="label" htmlFor="notes">Notes (optional)</label>
                <input
                  id="notes"
                  className="input"
                  placeholder="Felt strong, shorter rest…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="mt-1 text-[0.65rem] font-bold text-[var(--brand)] sm:hidden"
                onClick={() => setShowPickNotes((v) => !v)}
              >
                {showPickNotes ? 'Hide note' : 'Add note'}
              </button>
              {showPickNotes && (
                <input
                  className="input mt-1.5 sm:hidden"
                  placeholder="Optional note…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  aria-label="Notes"
                />
              )}
            </section>
            <section className="glass flex min-h-[11rem] flex-col overflow-hidden rounded-[var(--radius)] p-3 sm:h-[min(42dvh,22rem)]">
              <h2 className="mb-1 shrink-0 font-display text-sm font-bold sm:mb-2">Find & add</h2>
              {renderExerciseBrowser('min-h-0 flex-1', true)}
            </section>
            {selected.length > 0 && (
              <section className="glass shrink-0 space-y-2 rounded-[var(--radius)] p-3 sm:hidden">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{selected.length} in workout</p>
                  <button
                    type="button"
                    className="text-xs font-bold text-[var(--brand)]"
                    onClick={() => setPickListOpen((v) => !v)}
                  >
                    {pickListOpen ? 'Done' : 'Edit reps'}
                  </button>
                </div>
                {!pickListOpen && (
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {selected.map((ex, exIdx) => (
                      <span
                        key={`${ex.exerciseId}-${exIdx}`}
                        className="inline-flex max-w-[10rem] shrink-0 items-center gap-1 rounded-full border border-[var(--line)] bg-white py-1 pl-2.5 pr-1 text-[0.65rem] font-bold"
                      >
                        <span className="truncate">{ex.exerciseName}</span>
                        <button
                          type="button"
                          className="rounded-full p-1 text-[var(--ink-muted)]"
                          onClick={() => removeExercise(exIdx)}
                          aria-label={`Remove ${ex.exerciseName}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {(session || logStep === 'exercises') && (
        <div
          className={`flex items-center justify-between animate-fade-up shrink-0 ${
            isPickStep && selected.length > 0 ? 'hidden sm:flex' : isPickStep ? 'hidden sm:flex' : ''
          }`}
        >
          <h2 className="font-display text-lg font-bold sm:text-xl">
            Your list ({selected.length})
          </h2>
          {!session && (
            <button type="button" className="text-xs font-bold text-[var(--brand)]" onClick={() => setLogStep('template')}>
              Templates
            </button>
          )}
          {session && (
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
                <button type="button" className="btn btn-secondary px-3 py-1.5 text-sm" onClick={() => startRest()}>
                  Rest timer
                </button>
              )}
            </div>
          )}
        </div>
        )}

        {(session || logStep === 'exercises') && fieldErrors.exercises && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-[var(--danger)]">
            {fieldErrors.exercises}
          </p>
        )}
        {(session || logStep === 'exercises') && fieldErrors.sets && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-[var(--danger)]">
            {fieldErrors.sets}
          </p>
        )}

        {(session || logStep === 'exercises') && selected.length === 0 && (
          <p
            className={`rounded-xl border border-dashed px-4 py-4 text-center text-sm text-[var(--ink-muted)] sm:py-6 ${
              fieldErrors.exercises ? 'border-[var(--danger)]' : 'border-[var(--line)]'
            } ${isPickStep ? 'hidden sm:block' : ''}`}
          >
            Search above and tap exercises to add them here.
          </p>
        )}

        {(session || logStep === 'exercises') && (
        <div
          className={
            session
              ? 'space-y-4'
              : [
                  'space-y-3 sm:space-y-4',
                  isPickStep && !pickListOpen ? 'hidden sm:block' : '',
                  isPickStep && pickListOpen
                    ? 'max-h-[min(42dvh,22rem)] overflow-y-auto overscroll-contain sm:max-h-none sm:overflow-visible'
                    : isPickStep
                      ? 'sm:max-h-none'
                      : 'max-h-[min(30dvh,16rem)] overflow-y-auto overscroll-contain sm:max-h-none sm:overflow-visible',
                ].join(' ')
          }
        >
        {selected.map((ex, exIdx) => {
          const done = isExerciseDone(ex)
          const isFocus = Boolean(session) && focusIndex === exIdx && !done && !resting
          // "Next" only when resting before an exercise that hasn't started any sets yet
          const isNextUp =
            Boolean(session) &&
            resting &&
            focusIndex === exIdx &&
            !done &&
            ex.sets.every((s) => !s.completed)
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
              {isFocus ? (
                <div className="space-y-3">
                  <ExerciseImage
                    imageKey={ex.imageKey}
                    muscle={ex.muscle}
                    size="hero"
                    preferVideo
                    className="mx-auto"
                  />
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-bold text-base">{ex.exerciseName}</p>
                        {!resting && (
                          <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--accent)]">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--ink-muted)]">{MUSCLE_LABELS[ex.muscle]}</p>
                    </div>
                  </div>
                </div>
              ) : (
              <div className="flex items-start gap-3">
                <ExerciseImage
                  imageKey={ex.imageKey}
                  muscle={ex.muscle}
                  size={isNextUp ? 'md' : 'sm'}
                  preferVideo={isNextUp}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold">{ex.exerciseName}</p>
                    {done && (
                      <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--brand)]">
                        Done
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
              )}

              {(!session || isFocus || isNextUp || done) && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 px-1 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    <span>#</span>
                    <span>Reps</span>
                    <span>Weight ({units})</span>
                    <span />
                  </div>
                  {!session && (
                    <p className="px-1 text-xs text-[var(--ink-muted)]">
                      Edit reps and weight now — mark sets done after you start the workout.
                    </p>
                  )}
                  {ex.sets.map((set, setIdx) => {
                    const canCompleteSet =
                      Boolean(session) && isFocus && !resting && !isPaused
                    return (
                    <div key={setIdx} className="grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2">
                      <button
                        type="button"
                        disabled={!canCompleteSet}
                        title={
                          !session
                            ? 'Start the workout to mark sets done'
                            : !isFocus
                              ? 'This exercise is not active'
                              : resting
                                ? 'Finish or skip rest first'
                                : undefined
                        }
                        onClick={() => {
                          if (!canCompleteSet) return
                          const markingDone = !set.completed
                          updateSet(exIdx, setIdx, { completed: markingDone })
                          if (markingDone) startRest(BETWEEN_EXERCISE_REST_SEC)
                        }}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                          set.completed
                            ? 'bg-[var(--brand)] text-white'
                            : canCompleteSet
                              ? 'bg-white border border-[var(--line)]'
                              : 'bg-white/70 border border-[var(--line)] opacity-60'
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
                    )
                  })}
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
        </div>
        )}

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

        {!session && logStep === 'exercises' ? (
          <>
            <div className="fixed inset-x-0 z-20 grid max-w-[34rem] gap-2 border-t border-[var(--line)] bg-[var(--bg)]/98 px-[var(--page-pad)] py-3 backdrop-blur bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 sm:static sm:inset-auto sm:translate-x-0 sm:grid-cols-2 sm:border-0 sm:bg-transparent sm:p-0">
              <button type="submit" className="btn btn-secondary w-full" disabled={busy}>
                {busy ? 'Saving…' : 'Save to plan'}
              </button>
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={busy}
                onClick={onStartWorkout}
              >
                <Play size={16} /> Start · {selected.length}
              </button>
            </div>
            <div className="h-[5.5rem] shrink-0 sm:hidden" aria-hidden />
          </>
        ) : !session ? null : (
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

      <SaveWorkoutToPlanModal
        open={savePresetModal != null}
        workoutTitle={savePresetModal?.title ?? ''}
        exerciseCount={savePresetModal?.exerciseNames.length ?? 0}
        initialWeekday={effectivePlanWeekday}
        busy={busy}
        onClose={() => setSavePresetModal(null)}
        onConfirm={(wd) => void confirmSavePresetToPlan(wd)}
      />
    </div>
  )
}
