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
import { DEFAULT_WEEKLY_WORKOUTS, positiveOrDefault } from '../data/goals'
import { getPlanDayForWeekday, WEEKDAY_LABELS, type Weekday } from '../data/plans'
import { readLogPlanWeekdayOverride } from '../lib/logPlanOverride'
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
  const calendarWeekday = new Date().getDay() as Weekday
  const planWeekdayForToday =
    user?.id != null
      ? (readLogPlanWeekdayOverride(user.id, today) ?? calendarWeekday)
      : calendarWeekday
  const todayPlan = activePlan
    ? getPlanDayForWeekday(activePlan.days, planWeekdayForToday)
    : undefined
  const planDayOverridden =
    user?.id != null &&
    readLogPlanWeekdayOverride(user.id, today) != null &&
    planWeekdayForToday !== calendarWeekday
  const weeklyGoal = positiveOrDefault(goals?.weeklyWorkouts, DEFAULT_WEEKLY_WORKOUTS)
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

  const logHref =
    todayPlan && todayPlan.muscles.length > 0 ? '/log?fromPlan=1' : '/log'
  const logTitle =
    todayPlan && todayPlan.muscles.length > 0
      ? todayPlan.title
      : `Workout — ${format(new Date(), 'MMM d')}`

  function renderPlanPanel(variant: 'mobile' | 'desktop') {
    if (!activePlan || !todayPlan) return null
    const compact = variant === 'mobile'

    return (
      <section
        className={`glass animate-fade-up rounded-[var(--radius)] ${compact ? 'p-3 lg:hidden' : 'hidden p-4 lg:block'}`}
        style={{ animationDelay: '70ms' }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[0.65rem] font-bold uppercase tracking-wider text-[var(--brand)]">
            {activePlan.name} · {WEEKDAY_LABELS[planWeekdayForToday]}
            {planDayOverridden ? ' · your pick' : ''}
          </p>
          <Link to="/plans" className="shrink-0 text-[0.65rem] font-bold text-[var(--ink-muted)]">
            Change
          </Link>
        </div>
        <h2 className={`font-display font-bold ${compact ? 'mt-0.5 text-lg' : 'mt-1 text-2xl'}`}>
          {todayPlan.muscles.length === 0 ? 'Rest day' : todayPlan.title}
        </h2>
        {todayPlan.muscles.length > 0 && (
          <>
            <p className={`text-[var(--ink-muted)] ${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'}`}>
              {todayPlan.muscles.map((m) => MUSCLE_LABELS[m]).join(' · ')} ·{' '}
              {todayPlan.exerciseNames.length} exercises
            </p>
            {!todayWorkout && (
              <div className={`grid gap-2 ${compact ? 'mt-2 sm:grid-cols-2' : 'mt-4'}`}>
                <Link to="/log?fromPlan=1" className="btn btn-accent w-full py-2 text-sm">
                  <Plus size={16} />
                  Load plan day
                </Link>
                <Link to="/log" className="btn btn-secondary w-full py-2 text-sm">
                  Custom workout
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <header className="animate-fade-up flex items-center justify-between gap-2 lg:hidden">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-[var(--ink-muted)]">
            {format(new Date(), 'EEE, MMM d')} · {goals?.focus || 'Stay consistent'}
          </p>
          <h1 className="font-display text-2xl font-extrabold leading-tight">
            Hey, {user?.name.split(' ')[0]}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--accent)]">
          <Flame size={14} />
          {streak}d
        </div>
      </header>

      <header className="animate-fade-up hidden items-end justify-between gap-4 lg:flex">
        <div>
          <h1 className="page-title">Hey, {user?.name.split(' ')[0]}</h1>
          <p className="page-subtitle">
            {goals?.focus || 'Stay consistent'} · {streak} day streak
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-extrabold text-[var(--accent)]">
          <Flame size={16} />
          {streak} day{streak === 1 ? '' : 's'}
        </div>
      </header>

      <div className="desktop-grid desktop-grid--2 lg:gap-5">
        <div className="flex flex-col gap-3 sm:gap-5">
          <section
            className="glass animate-fade-up rounded-[var(--radius)] p-3 shadow-[var(--shadow)] sm:p-5"
            style={{ animationDelay: '50ms' }}
          >
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="shrink-0 sm:hidden">
                <ProgressRing
                  value={progress}
                  size={72}
                  stroke={8}
                  label={`${thisWeek.length}/${weeklyGoal}`}
                  sublabel="week"
                />
              </div>
              <div className="hidden shrink-0 sm:block">
                <ProgressRing
                  value={progress}
                  size={120}
                  label={`${thisWeek.length}/${weeklyGoal}`}
                  sublabel="this week"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold sm:text-xl">Weekly goal</p>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)] sm:mt-1 sm:text-sm">
                  {goals?.focus || 'Stay consistent'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1 sm:mt-4 sm:gap-1.5">
                  {weekDays.map((d) => {
                    const key = format(d, 'yyyy-MM-dd')
                    const hit = thisWeek.some((w) => w.date === key)
                    const isToday = isSameDay(d, new Date())
                    return (
                      <div
                        key={key}
                        title={key}
                        className={`flex h-7 w-7 flex-col items-center justify-center rounded-md text-[0.6rem] font-bold sm:h-9 sm:w-9 sm:rounded-lg sm:text-[0.65rem] ${
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

          {renderPlanPanel('mobile')}

          <section className="animate-fade-up" style={{ animationDelay: '100ms' }}>
            {todayWorkout ? (
              <div className="glass rounded-[var(--radius)] p-3 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[var(--brand)]">
                      Today’s session
                    </p>
                    <h2 className="mt-0.5 truncate font-display text-lg font-bold sm:mt-1 sm:text-2xl">
                      {todayWorkout.title}
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--ink-muted)] sm:mt-1 sm:text-sm">
                      <Timer size={14} />
                      {todayWorkout.durationMin} min · {todayWorkout.exercises.length} exercises
                    </p>
                  </div>
                  <Link
                    to={`/history/${todayWorkout.id}`}
                    className="btn btn-secondary shrink-0 px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
                  >
                    View
                  </Link>
                </div>
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 sm:mt-4 sm:gap-2">
                  {todayWorkout.exercises.slice(0, 6).map((ex) => (
                    <div key={`${ex.exerciseId}-${ex.exerciseName}`} className="shrink-0">
                      <ExerciseImage imageKey={ex.imageKey} muscle={ex.muscle} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                to={logHref}
                className="group relative flex overflow-hidden rounded-[var(--radius)] bg-[var(--brand)] p-4 text-white shadow-[var(--shadow)] sm:min-h-[12rem] sm:p-6 lg:min-h-[14rem]"
              >
                <div className="relative z-10 min-w-0 flex-1">
                  <p className="text-xs font-bold text-teal-100 sm:text-sm">Ready when you are</p>
                  <h2 className="mt-0.5 font-display text-lg font-extrabold leading-snug sm:mt-1 sm:text-2xl lg:text-3xl">
                    Log {logTitle}
                  </h2>
                  <p className="mt-1 hidden text-sm text-teal-50/90 sm:block sm:max-w-xs">
                    Track sets, reps, and weight — works fully offline.
                  </p>
                  <span className="btn mt-3 bg-white px-3 py-2 text-sm text-[var(--brand)] sm:mt-5">
                    <Plus size={16} />
                    Start logging
                  </span>
                </div>
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 sm:-right-6 sm:-top-6 sm:h-40 sm:w-40" />
              </Link>
            )}
          </section>

          <div className="lg:hidden">
            <WaterQuickCard compact />
          </div>

          {recent.length > 0 && (
            <section className="animate-fade-up space-y-2 sm:space-y-3" style={{ animationDelay: '150ms' }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold sm:text-xl">Recent</h2>
                <Link to="/history" className="text-xs font-bold text-[var(--brand)] sm:text-sm">
                  See all
                </Link>
              </div>
              {recent.slice(0, 2).map((w, i) => (
                <Link
                  key={w.id}
                  to={`/history/${w.id}`}
                  className="glass animate-slide-in flex items-center gap-2.5 rounded-xl p-2.5 sm:gap-3 sm:rounded-2xl sm:p-3"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {w.exercises[0] ? (
                    <ExerciseImage
                      imageKey={w.exercises[0].imageKey}
                      muscle={w.exercises[0].muscle}
                      size="sm"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] sm:h-12 sm:w-12 sm:rounded-2xl">
                      <Timer size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-bold sm:text-base">{w.title}</p>
                    <p className="text-[0.65rem] text-[var(--ink-muted)] sm:text-xs">
                      {format(parseISO(w.date), 'MMM d')} · {w.durationMin} min
                      {w.exercises[0] && ` · ${MUSCLE_LABELS[w.exercises[0].muscle]}`}
                    </p>
                  </div>
                </Link>
              ))}
              {recent.length > 2 && (
                <Link to="/history" className="block text-center text-xs font-bold text-[var(--brand)] sm:hidden">
                  +{recent.length - 2} more in history
                </Link>
              )}
            </section>
          )}
        </div>

        <div className="desktop-grid--stack-right hidden flex-col gap-3 sm:gap-5 lg:flex">
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

          {renderPlanPanel('desktop')}
        </div>
      </div>

      {!activePlan && (
        <Link
          to="/plans"
          className="glass animate-fade-up flex items-center gap-3 rounded-[var(--radius)] p-3 lg:hidden"
          style={{ animationDelay: '70ms' }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <CalendarDays size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Choose a weekly plan</p>
            <p className="text-xs text-[var(--ink-muted)]">Bro split, PPL, or custom days</p>
          </div>
        </Link>
      )}
    </div>
  )
}
