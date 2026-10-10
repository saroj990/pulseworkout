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
import { Flame, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { db } from '../db'
import { DEFAULT_WEEKLY_WORKOUTS, positiveOrDefault } from '../data/goals'
import { getPlanDayForWeekday, type Weekday } from '../data/plans'
import { readLogPlanWeekdayOverride } from '../lib/logPlanOverride'
import { DEFAULT_WATER_GOAL_ML, formatWater, waterProgress } from '../lib/water'

function formatWaterShort(ml: number): string {
  if (ml <= 0) return '—'
  if (ml >= 1000) {
    const L = ml / 1000
    return `${Number.isInteger(L) ? L : L.toFixed(1).replace(/\.0$/, '')}L`
  }
  return `${ml}`
}

export function DashboardPage() {
  const { user, goals, preferences } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const firstName = user?.name.split(' ')[0] ?? 'there'

  const workouts = useLiveQuery(
    () => (user?.id ? db.workouts.where('userId').equals(user.id).toArray() : []),
    [user?.id],
  )

  const waterLogs = useLiveQuery(
    () => (user?.id ? db.waterLogs.where('userId').equals(user.id).toArray() : []),
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

  const weeklyGoal = positiveOrDefault(goals?.weeklyWorkouts, DEFAULT_WEEKLY_WORKOUTS)

  const streak = (() => {
    let count = 0
    let cursor = new Date()
    const dates = new Set((workouts ?? []).map((w) => w.date))
    if (!dates.has(format(cursor, 'yyyy-MM-dd'))) cursor = subDays(cursor, 1)
    while (dates.has(format(cursor, 'yyyy-MM-dd'))) {
      count++
      cursor = subDays(cursor, 1)
    }
    return count
  })()

  const goalMl = goals?.dailyWaterMl && goals.dailyWaterMl > 0 ? goals.dailyWaterMl : DEFAULT_WATER_GOAL_ML
  const todayWater = (waterLogs ?? [])
    .filter((l) => l.date === today)
    .reduce((s, l) => s + l.amountMl, 0)
  const waterPct = waterProgress(todayWater, goalMl)

  const last3WaterDays = [0, 1, 2].map((i) => {
    const d = subDays(new Date(), i)
    const key = format(d, 'yyyy-MM-dd')
    const ml = (waterLogs ?? []).filter((l) => l.date === key).reduce((s, l) => s + l.amountMl, 0)
    return { key, tag: format(d, 'EEEEE'), ml }
  })

  const waterHistoryLine = last3WaterDays
    .map((row) => `${row.tag} ${formatWaterShort(row.ml)}`)
    .join('  ·  ')

  async function quickAddWater(ml: number) {
    if (!user?.id) return
    await db.waterLogs.add({
      userId: user.id,
      date: today,
      amountMl: ml,
      createdAt: new Date().toISOString(),
    })
  }

  const logHref =
    todayPlan && todayPlan.muscles.length > 0 ? '/log?fromPlan=1' : '/log'
  const focusTitle = todayWorkout?.title ?? (
    todayPlan && todayPlan.muscles.length > 0
      ? todayPlan.title
      : `Workout — ${format(new Date(), 'MMM d')}`
  )

  const focusSub = todayWorkout
    ? `${todayWorkout.durationMin}m · ${todayWorkout.exercises.length}ex logged`
    : todayPlan && todayPlan.muscles.length > 0
      ? todayPlan.muscles.length === 0
        ? 'Rest day — log if you train'
        : `${todayPlan.exerciseNames.length}ex on plan`
      : 'Ready to log'

  return (
    <div className="home-page mx-auto flex max-w-lg flex-col lg:max-w-xl">
      <header className="home-section home-section--tight flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-extrabold tracking-tight">
          Hey, {firstName}
        </h1>
        <p className="home-meta flex items-center gap-2">
          <span>{format(new Date(), 'MMM d')}</span>
          <span className="inline-flex items-center gap-0.5 font-bold text-[var(--accent)]">
            <Flame size={14} />
            {streak}
          </span>
        </p>
      </header>

      <section className="home-section home-section--tight">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="home-heading">Weekly goal</h2>
          <p className="home-body tabular-nums">
            <span className="text-[var(--brand)]">{thisWeek.length}</span>
            <span className="home-meta font-semibold">/{weeklyGoal}</span>
          </p>
        </div>
        <div className="mt-2 flex gap-0.5">
          {weekDays.map((d) => {
            const key = format(d, 'yyyy-MM-dd')
            const hit = thisWeek.some((w) => w.date === key)
            const isToday = isSameDay(d, new Date())
            return (
              <div
                key={key}
                title={key}
                className={`home-chip flex h-7 min-w-0 flex-1 items-center justify-center rounded-md font-bold ${
                  hit
                    ? 'bg-[var(--brand)] text-white shadow-sm'
                    : isToday
                      ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                      : 'bg-[var(--bg-elevated)] text-[var(--ink-muted)]'
                }`}
              >
                {format(d, 'EEEEE')}
              </div>
            )
          })}
        </div>
      </section>

      <section className="home-section home-section--tight">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="home-heading">Water</h2>
          <Link to="/water" className="home-link">
            More
          </Link>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <p className="home-body tabular-nums">
            {formatWater(todayWater)}
            <span className="home-meta font-semibold"> / {formatWater(goalMl)}</span>
          </p>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all"
            style={{ width: `${Math.max(waterPct * 100, 2)}%` }}
          />
        </div>
        <div className="mt-2 flex gap-1.5">
          <button type="button" className="home-pill-btn flex-1" onClick={() => quickAddWater(250)}>
            <Plus size={14} strokeWidth={2.5} /> 250
          </button>
          <button type="button" className="home-pill-btn flex-1" onClick={() => quickAddWater(500)}>
            <Plus size={14} strokeWidth={2.5} /> 500
          </button>
        </div>
        <p className="home-meta mt-2 truncate tabular-nums tracking-tight" title={waterHistoryLine}>
          {waterHistoryLine}
        </p>
      </section>

      <section className="home-focus home-section mt-auto shrink-0">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-teal-100/90">
          Today&apos;s focus
        </p>
        <p className="mt-1 truncate font-display text-lg font-extrabold leading-snug">{focusTitle}</p>
        <p className="mt-0.5 truncate text-xs font-semibold text-teal-50/85">{focusSub}</p>
        {todayWorkout ? (
          <Link
            to={`/history/${todayWorkout.id}`}
            className="home-focus-btn mt-3 flex w-full items-center justify-center gap-2"
          >
            View session
          </Link>
        ) : (
          <div className="mt-3 flex gap-2">
            <Link to={logHref} className="home-focus-btn flex flex-1 items-center justify-center gap-2">
              <Plus size={18} strokeWidth={2.5} />
              Log workout
            </Link>
            {!activePlan && (
              <Link
                to="/plans"
                className="flex shrink-0 items-center justify-center rounded-xl border border-white/25 px-3 py-2.5 text-xs font-bold text-white"
              >
                Plan
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
