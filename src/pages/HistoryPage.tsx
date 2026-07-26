import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  format,
  isThisMonth,
  isToday,
  isYesterday,
  parseISO,
  startOfMonth,
} from 'date-fns'
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Search,
  Trash2,
  Weight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { db, type MuscleGroup, type Workout } from '../db'
import { ExerciseImage } from '../components/ExerciseImage'
import { MUSCLE_COLORS, MUSCLE_LABELS } from '../data/exercises'

function formatWorkoutDay(dateStr: string) {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE, MMM d')
}

function monthKey(dateStr: string) {
  return format(startOfMonth(parseISO(dateStr)), 'yyyy-MM')
}

function monthLabel(key: string) {
  return format(parseISO(`${key}-01`), 'MMMM yyyy')
}

function primaryMuscles(workout: Workout): MuscleGroup[] {
  const counts = new Map<MuscleGroup, number>()
  for (const ex of workout.exercises) {
    counts.set(ex.muscle, (counts.get(ex.muscle) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m)
    .slice(0, 3)
}

function totalSets(workout: Workout) {
  return workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
}

function completedSets(workout: Workout) {
  return workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0,
  )
}

function totalVolume(workout: Workout) {
  return workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0),
    0,
  )
}

function topWeight(workout: Workout) {
  let max = 0
  for (const ex of workout.exercises) {
    for (const set of ex.sets) max = Math.max(max, set.weight)
  }
  return max
}

type Filter = 'all' | 'month' | MuscleGroup

export function HistoryPage() {
  const { user, preferences } = useAuth()
  const units = preferences?.units ?? 'kg'
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const workouts = useLiveQuery(async () => {
    if (!user?.id) return []
    const list = await db.workouts.where('userId').equals(user.id).toArray()
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
  }, [user?.id])

  const list = workouts ?? []

  const stats = useMemo(() => {
    const monthSessions = list.filter((w) => isThisMonth(parseISO(w.date))).length
    const totalMin = list.reduce((s, w) => s + w.durationMin, 0)
    const streakLike = list.filter((w) => isToday(parseISO(w.date)) || isYesterday(parseISO(w.date))).length
    return {
      sessions: list.length,
      monthSessions,
      totalMin,
      recentTouch: streakLike,
    }
  }, [list])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((w) => {
      if (filter === 'month' && !isThisMonth(parseISO(w.date))) return false
      if (filter !== 'all' && filter !== 'month') {
        if (!w.exercises.some((ex) => ex.muscle === filter)) return false
      }
      if (!q) return true
      const hay = [
        w.title,
        w.notes,
        ...w.exercises.map((ex) => ex.exerciseName),
        ...w.exercises.map((ex) => MUSCLE_LABELS[ex.muscle]),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [list, query, filter])

  const grouped = useMemo(() => {
    const map = new Map<string, Workout[]>()
    for (const w of filtered) {
      const key = monthKey(w.date)
      const bucket = map.get(key) ?? []
      bucket.push(w)
      map.set(key, bucket)
    }
    return [...map.entries()]
  }, [filtered])

  const muscleFilters: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']

  return (
    <div className="space-y-5">
      <header className="animate-fade-up">
        <p className="text-sm font-bold text-[var(--brand)]">Your training log</p>
        <h1 className="font-display text-3xl font-extrabold">History</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Review past sessions, volume, and progress over time.
        </p>
      </header>

      {list.length > 0 && (
        <section
          className="grid grid-cols-3 gap-2 animate-fade-up"
          style={{ animationDelay: '40ms' }}
        >
          <StatTile label="Sessions" value={String(stats.sessions)} icon={<Dumbbell size={16} />} />
          <StatTile label="This month" value={String(stats.monthSessions)} icon={<Flame size={16} />} />
          <StatTile
            label="Total time"
            value={stats.totalMin >= 60 ? `${Math.round(stats.totalMin / 60)}h` : `${stats.totalMin}m`}
            icon={<Clock3 size={16} />}
          />
        </section>
      )}

      {list.length > 0 && (
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: '70ms' }}>
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-[var(--ink-muted)]"
              aria-hidden
            />
            <input
              className="input input-with-icon"
              type="search"
              placeholder="Search by title or exercise"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search history"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                { id: 'all' as const, label: 'All' },
                { id: 'month' as const, label: 'This month' },
                ...muscleFilters.map((m) => ({ id: m as Filter, label: MUSCLE_LABELS[m] })),
              ]
            ).map((chip) => {
              const on = filter === chip.id
              return (
                <button
                  key={String(chip.id)}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    on
                      ? 'bg-[var(--brand)] text-white'
                      : 'bg-white border border-[var(--line)] text-[var(--ink-muted)]'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {list.length === 0 && (
        <div className="glass animate-fade-up overflow-hidden rounded-[var(--radius)]">
          <div className="bg-[linear-gradient(135deg,var(--brand)_0%,#0b5550_55%,#134e4a_100%)] px-6 py-8 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Dumbbell size={22} />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold">No sessions yet</h2>
            <p className="mt-2 max-w-xs text-sm text-teal-50/90">
              When you log a workout, it shows up here with sets, volume, and muscle focus.
            </p>
          </div>
          <div className="p-5">
            <Link to="/log" className="btn btn-primary w-full">
              Log your first workout
            </Link>
          </div>
        </div>
      )}

      {list.length > 0 && filtered.length === 0 && (
        <div className="glass rounded-[var(--radius)] p-8 text-center">
          <p className="font-bold">No matching sessions</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Try another search or clear the filter.</p>
          <button
            type="button"
            className="btn btn-secondary mt-4"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(([key, items], groupIdx) => (
          <section key={key} className="space-y-3">
            <div
              className="animate-fade-up flex items-end justify-between"
              style={{ animationDelay: `${80 + groupIdx * 30}ms` }}
            >
              <h2 className="font-display text-lg font-bold">{monthLabel(key)}</h2>
              <p className="text-xs font-bold text-[var(--ink-muted)]">
                {items.length} session{items.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="space-y-2.5">
              {items.map((w, i) => {
                const muscles = primaryMuscles(w)
                const setsDone = completedSets(w)
                const setsTotal = totalSets(w)
                const volume = totalVolume(w)
                const heaviest = topWeight(w)

                return (
                  <Link
                    key={w.id}
                    to={`/history/${w.id}`}
                    className="group glass animate-slide-in flex gap-3 rounded-[1.1rem] p-3.5 transition hover:border-[var(--brand)]/40 hover:shadow-[var(--shadow)]"
                    style={{ animationDelay: `${Math.min(i, 6) * 35}ms` }}
                  >
                    <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                      <span className="text-[0.65rem] font-bold uppercase tracking-wide">
                        {format(parseISO(w.date), 'MMM')}
                      </span>
                      <span className="font-display text-xl font-extrabold leading-none">
                        {format(parseISO(w.date), 'd')}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-bold leading-snug">{w.title}</p>
                          <p className="mt-0.5 text-xs font-semibold text-[var(--ink-muted)]">
                            {formatWorkoutDay(w.date)}
                          </p>
                        </div>
                        <ChevronRight
                          size={18}
                          className="mt-0.5 shrink-0 text-[var(--ink-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand)]"
                        />
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <MetaPill icon={<Clock3 size={12} />}>{w.durationMin} min</MetaPill>
                        <MetaPill icon={<Dumbbell size={12} />}>
                          {w.exercises.length} moves
                        </MetaPill>
                        <MetaPill>
                          {setsDone}/{setsTotal} sets
                        </MetaPill>
                        {heaviest > 0 && (
                          <MetaPill icon={<Weight size={12} />}>
                            {heaviest} {units}
                          </MetaPill>
                        )}
                      </div>

                      {(muscles.length > 0 || volume > 0) && (
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap gap-1">
                            {muscles.map((m) => (
                              <span
                                key={m}
                                className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold text-white"
                                style={{ background: MUSCLE_COLORS[m] }}
                              >
                                {MUSCLE_LABELS[m]}
                              </span>
                            ))}
                          </div>
                          {volume > 0 && (
                            <p className="shrink-0 text-[0.7rem] font-bold text-[var(--ink-muted)]">
                              {Math.round(volume).toLocaleString()} {units} vol
                            </p>
                          )}
                        </div>
                      )}

                      {w.exercises[0] && (
                        <div className="mt-2.5 flex items-center gap-2 border-t border-[var(--line)]/80 pt-2.5">
                          <div className="flex -space-x-2">
                            {w.exercises.slice(0, 4).map((ex, idx) => (
                              <div
                                key={`${ex.exerciseId}-${idx}`}
                                className="rounded-xl ring-2 ring-white"
                              >
                                <ExerciseImage
                                  imageKey={ex.imageKey}
                                  muscle={ex.muscle}
                                  size="sm"
                                  className="!h-8 !w-8 !rounded-xl"
                                />
                              </div>
                            ))}
                          </div>
                          <p className="truncate text-xs text-[var(--ink-muted)]">
                            {w.exercises
                              .slice(0, 2)
                              .map((ex) => ex.exerciseName)
                              .join(' · ')}
                            {w.exercises.length > 2 ? ` +${w.exercises.length - 2}` : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="glass rounded-2xl px-3 py-3">
      <div className="flex items-center gap-1.5 text-[var(--brand)]">{icon}</div>
      <p className="mt-1.5 font-display text-xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
        {label}
      </p>
    </div>
  )
}

function MetaPill({
  children,
  icon,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[0.7rem] font-bold text-[var(--ink-muted)] border border-[var(--line)]">
      {icon}
      {children}
    </span>
  )
}

export function WorkoutDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { preferences } = useAuth()
  const units = preferences?.units ?? 'kg'
  const workoutId = Number(id)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const workout = useLiveQuery(
    () => (Number.isFinite(workoutId) ? db.workouts.get(workoutId) : undefined),
    [workoutId],
  )

  async function onDelete() {
    if (!workout?.id) return
    await db.workouts.delete(workout.id)
    navigate('/history')
  }

  if (workout === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[var(--ink-muted)]">
        Loading session…
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="glass space-y-4 rounded-[var(--radius)] p-6 text-center">
        <p className="font-bold">Workout not found</p>
        <p className="text-sm text-[var(--ink-muted)]">It may have been deleted on this device.</p>
        <Link to="/history" className="btn btn-secondary">
          Back to history
        </Link>
      </div>
    )
  }

  const muscles = primaryMuscles(workout)
  const setsDone = completedSets(workout)
  const setsTotal = totalSets(workout)
  const volume = totalVolume(workout)
  const heaviest = topWeight(workout)

  return (
    <div className="space-y-5">
      <header className="animate-fade-up">
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-muted)]"
        >
          <ArrowLeft size={16} /> History
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--brand)]">{formatWorkoutDay(workout.date)}</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight">
              {workout.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {format(parseISO(workout.date), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          {!confirmDelete ? (
            <button
              type="button"
              className="btn btn-secondary shrink-0 p-2.5 text-[var(--danger)]"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete workout"
            >
              <Trash2 size={18} />
            </button>
          ) : null}
        </div>
      </header>

      {confirmDelete && (
        <div className="animate-fade-up rounded-[var(--radius)] border border-red-200 bg-red-50 p-4">
          <p className="font-bold text-[var(--danger)]">Delete this session?</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">This can’t be undone on this device.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
            <button
              type="button"
              className="btn flex-1 bg-[var(--danger)] text-white"
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <section
        className="glass animate-fade-up rounded-[var(--radius)] p-4"
        style={{ animationDelay: '40ms' }}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DetailStat label="Duration" value={`${workout.durationMin} min`} />
          <DetailStat label="Exercises" value={String(workout.exercises.length)} />
          <DetailStat label="Sets done" value={`${setsDone}/${setsTotal}`} />
          <DetailStat
            label="Volume"
            value={volume > 0 ? `${Math.round(volume).toLocaleString()}` : '—'}
            hint={volume > 0 ? units : undefined}
          />
        </div>
        {(muscles.length > 0 || heaviest > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
            {muscles.map((m) => (
              <span
                key={m}
                className="rounded-full px-2.5 py-1 text-xs font-bold text-white"
                style={{ background: MUSCLE_COLORS[m] }}
              >
                {MUSCLE_LABELS[m]}
              </span>
            ))}
            {heaviest > 0 && (
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--ink-muted)] border border-[var(--line)]">
                Peak {heaviest} {units}
              </span>
            )}
          </div>
        )}
      </section>

      {workout.notes && (
        <section className="glass animate-fade-up rounded-[var(--radius)] p-4" style={{ animationDelay: '70ms' }}>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-muted)]">Notes</p>
          <p className="mt-2 text-sm leading-relaxed">{workout.notes}</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Exercises</h2>
          <p className="text-xs font-bold text-[var(--ink-muted)]">
            {workout.exercises.length} total
          </p>
        </div>

        {workout.exercises.map((ex, i) => {
          const exVolume = ex.sets.reduce((s, set) => s + set.reps * set.weight, 0)
          const exTop = ex.sets.reduce((max, s) => Math.max(max, s.weight), 0)
          return (
            <article
              key={`${ex.exerciseId}-${i}`}
              className="glass animate-slide-in overflow-hidden rounded-[var(--radius)]"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center gap-3 border-b border-[var(--line)]/70 px-4 py-3">
                <ExerciseImage imageKey={ex.imageKey} muscle={ex.muscle} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{ex.exerciseName}</p>
                  <p className="text-xs font-semibold text-[var(--ink-muted)]">
                    {MUSCLE_LABELS[ex.muscle]}
                    {exTop > 0 ? ` · top ${exTop} ${units}` : ''}
                    {exVolume > 0 ? ` · ${Math.round(exVolume)} vol` : ''}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold text-white"
                  style={{ background: MUSCLE_COLORS[ex.muscle] }}
                >
                  {ex.sets.filter((s) => s.completed).length}/{ex.sets.length}
                </span>
              </div>

              <div className="px-2 py-2">
                <div className="mb-1 grid grid-cols-[3rem_1fr_1fr_1fr] gap-1 px-2 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                  <span>Set</span>
                  <span>Reps</span>
                  <span>Weight</span>
                  <span className="text-right">Status</span>
                </div>
                <ul className="space-y-1">
                  {ex.sets.map((s, j) => (
                    <li
                      key={j}
                      className={`grid grid-cols-[3rem_1fr_1fr_1fr] items-center gap-1 rounded-xl px-2 py-2 text-sm ${
                        s.completed ? 'bg-[var(--brand-soft)]' : 'bg-white/70'
                      }`}
                    >
                      <span className="font-extrabold text-[var(--ink-muted)]">{j + 1}</span>
                      <span className="font-bold">{s.reps}</span>
                      <span className="font-bold">
                        {s.weight} <span className="text-xs font-semibold text-[var(--ink-muted)]">{units}</span>
                      </span>
                      <span className="text-right text-xs font-bold">
                        {s.completed ? (
                          <span className="text-[var(--brand)]">Done</span>
                        ) : (
                          <span className="text-[var(--ink-muted)]">Logged</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}

function DetailStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div>
      <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
      <p className="mt-1 font-display text-xl font-extrabold leading-none">
        {value}
        {hint && <span className="ml-1 text-xs font-bold text-[var(--ink-muted)]">{hint}</span>}
      </p>
    </div>
  )
}
