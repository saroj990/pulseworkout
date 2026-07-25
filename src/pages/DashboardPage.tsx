import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subDays,
} from 'date-fns'
import { CalendarDays, Flame, Plus, Timer } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { db } from '../db'
import { ProgressRing } from '../components/ProgressRing'
import { ExerciseImage } from '../components/ExerciseImage'
import { MUSCLE_LABELS } from '../data/exercises'
import { getPlanDayForDate, WEEKDAY_LABELS } from '../data/plans'
import { WaterQuickCard } from './WaterPage'

export function DashboardPage() {
  const { user, goals, preferences } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')

  const workouts = useLiveQuery(
    () => (user?.id ? db.workouts.where('userId').equals(user.id).toArray() : []),
    [user?.id],
  )

  const activePlan = useLiveQuery(async () => {
    if (!user?.id) return undefined
    return db.userPlans.where('userId').equals(user.id).filter((p) => p.active).first()
  }, [user?.id])

  const weekStart = startOfWeek(new Date(), {
    weekStartsOn: preferences?.weekStartsOn ?? 1,
  })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const thisWeek = (workouts ?? []).filter((w) => {
    const d = parseISO(w.date)
    return d >= weekStart && d < addDays(weekStart, 7)
  })

  const todayWorkout = (workouts ?? []).find((w) => w.date === today)
  const todayPlan = activePlan ? getPlanDayForDate(activePlan.days, new Date()) : undefined
  const weeklyGoal = goals?.weeklyWorkouts ?? 4
  const progress = Math.min(1, thisWeek.length / weeklyGoal)

  const streak = (() => {
    let count = 0
    let cursor = new Date()
    const dates = new Set((workouts ?? []).map((w) => w.date))
    if (!dates.has(format(cursor, 'yyyy-MM-dd'))) {
      cursor = subDays(cursor, 1)
    }
    while (dates.has(format(cursor, 'yyyy-MM-dd'))) {
      count++
      cursor = subDays(cursor, 1)
    }
    return count
  })()

  const recent = [...(workouts ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--ink-muted)]">
            {format(new Date(), 'EEEE, MMM d')}
          </p>
          <h1 className="font-display text-3xl font-extrabold">
            Hey, {user?.name.split(' ')[0]}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-extrabold text-[var(--accent)]">
          <Flame size={16} />
          {streak} day{streak === 1 ? '' : 's'}
        </div>
      </header>

      <section
        className="glass animate-fade-up rounded-[var(--radius)] p-5 shadow-[var(--shadow)]"
        style={{ animationDelay: '50ms' }}
      >
        <div className="flex items-center gap-5">
          <ProgressRing
            value={progress}
            label={`${thisWeek.length}/${weeklyGoal}`}
            sublabel="this week"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold">Weekly goal</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {goals?.focus || 'Stay consistent'}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {weekDays.map((d) => {
                const key = format(d, 'yyyy-MM-dd')
                const hit = thisWeek.some((w) => w.date === key)
                const isToday = isSameDay(d, new Date())
                return (
                  <div
                    key={key}
                    title={key}
                    className={`flex h-8 w-8 flex-col items-center justify-center rounded-lg text-[0.65rem] font-bold ${
                      hit
                        ? 'bg-[var(--brand)] text-white'
                        : isToday
                          ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                          : 'bg-white text-[var(--ink-muted)] border border-[var(--line)]'
                    }`}
                  >
                    {format(d, 'EEEEE')}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <WaterQuickCard />

      {!activePlan && (
        <Link
          to="/plans"
          className="glass animate-fade-up flex items-center gap-3 rounded-[var(--radius)] p-4"
          style={{ animationDelay: '70ms' }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <CalendarDays size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Choose a weekly plan</p>
            <p className="text-xs text-[var(--ink-muted)]">
              Bro split, PPL, or assign parts to each day yourself
            </p>
          </div>
        </Link>
      )}

      {activePlan && todayPlan && (
        <section
          className="glass animate-fade-up rounded-[var(--radius)] p-4"
          style={{ animationDelay: '70ms' }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">
              {activePlan.name} · {WEEKDAY_LABELS[todayPlan.weekday]}
            </p>
            <Link to="/plans" className="text-xs font-bold text-[var(--ink-muted)]">
              Change
            </Link>
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold">
            {todayPlan.muscles.length === 0 ? 'Rest day' : todayPlan.title}
          </h2>
          {todayPlan.muscles.length > 0 && (
            <>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                {todayPlan.muscles.map((m) => MUSCLE_LABELS[m]).join(' · ')} ·{' '}
                {todayPlan.exerciseNames.length} exercises
              </p>
              {!todayWorkout && (
                <Link to="/log?fromPlan=1" className="btn btn-accent mt-4 w-full">
                  <Plus size={18} />
                  Start today’s plan
                </Link>
              )}
            </>
          )}
        </section>
      )}

      <section className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        {todayWorkout ? (
          <div className="glass rounded-[var(--radius)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">
                  Today’s session
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold">{todayWorkout.title}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--ink-muted)]">
                  <Timer size={14} />
                  {todayWorkout.durationMin} min · {todayWorkout.exercises.length} exercises
                </p>
              </div>
              <Link to={`/history/${todayWorkout.id}`} className="btn btn-secondary text-sm px-3 py-2">
                View
              </Link>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {todayWorkout.exercises.slice(0, 5).map((ex) => (
                <div key={`${ex.exerciseId}-${ex.exerciseName}`} className="shrink-0">
                  <ExerciseImage imageKey={ex.imageKey} muscle={ex.muscle} size="sm" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Link
            to={todayPlan && todayPlan.muscles.length > 0 ? '/log?fromPlan=1' : '/log'}
            className="group relative flex overflow-hidden rounded-[var(--radius)] bg-[var(--brand)] p-6 text-white shadow-[var(--shadow)]"
          >
            <div className="relative z-10">
              <p className="text-sm font-bold text-teal-100">Ready when you are</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold">
                {todayPlan && todayPlan.muscles.length > 0
                  ? `Log ${todayPlan.title}`
                  : 'Log today’s workout'}
              </h2>
              <p className="mt-2 max-w-xs text-sm text-teal-50/90">
                Track sets, reps, and weight — works fully offline.
              </p>
              <span className="btn mt-5 bg-white text-[var(--brand)]">
                <Plus size={18} />
                Start logging
              </span>
            </div>
            <div className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rounded-full bg-white/10 transition group-hover:scale-110" />
            <div className="pointer-events-none absolute -bottom-10 right-8 h-32 w-32 rounded-full bg-orange-400/30" />
          </Link>
        )}
      </section>

      {recent.length > 0 && (
        <section className="animate-fade-up space-y-3" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Recent</h2>
            <Link to="/history" className="text-sm font-bold text-[var(--brand)]">
              See all
            </Link>
          </div>
          {recent.map((w, i) => (
            <Link
              key={w.id}
              to={`/history/${w.id}`}
              className="glass animate-slide-in flex items-center gap-3 rounded-2xl p-3"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {w.exercises[0] ? (
                <ExerciseImage
                  imageKey={w.exercises[0].imageKey}
                  muscle={w.exercises[0].muscle}
                  size="sm"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Timer size={20} />
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate font-bold">{w.title}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {format(parseISO(w.date), 'MMM d')} · {w.durationMin} min
                  {w.exercises[0] && ` · ${MUSCLE_LABELS[w.exercises[0].muscle]}`}
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
