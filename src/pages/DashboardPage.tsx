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
import {
  Bell,
  Calendar,
  Check,
  ChevronRight,
  Clock3,
  Droplets,
  Dumbbell,
  Flame,
  Plus,
  Settings,
  Target,
} from 'lucide-react'
import { ExerciseImage } from '../components/ExerciseImage'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { db, type MuscleGroup, type Workout } from '../db'
import { MUSCLE_LABELS } from '../data/exercises'
import { imageKeyForExercise } from '../data/exerciseImageKeys'
import { DEFAULT_WEEKLY_WORKOUTS, positiveOrDefault } from '../data/goals'
import { getPlanDayForWeekday, type Weekday } from '../data/plans'
import { readLogPlanWeekdayOverride } from '../lib/logPlanOverride'
import { DEFAULT_WATER_GOAL_ML, formatWater, waterProgress } from '../lib/water'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function litersCompact(ml: number): string {
  const liters = ml / 1000
  if (liters >= 10 || Number.isInteger(liters)) return String(liters)
  return liters.toFixed(1)
}

function primaryMuscle(workout: Workout): MuscleGroup | undefined {
  const counts = new Map<MuscleGroup, number>()
  for (const ex of workout.exercises) {
    counts.set(ex.muscle, (counts.get(ex.muscle) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0]
}

function focusRegionLabel(muscles: MuscleGroup[]): string {
  if (muscles.length === 0) return 'Training'
  const upper = new Set<MuscleGroup>(['chest', 'back', 'shoulders', 'arms'])
  const allUpper = muscles.every((m) => upper.has(m))
  const allLegs = muscles.every((m) => m === 'legs' || m === 'core')
  if (allUpper && !muscles.includes('legs')) return 'Upper body'
  if (allLegs) return 'Lower body'
  if (muscles.includes('cardio')) return 'Cardio'
  if (muscles.includes('full')) return 'Full body'
  return MUSCLE_LABELS[muscles[0]]
}

function estKcal(durationMin: number): number {
  return Math.max(0, Math.round(durationMin * 7.5))
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

  const workoutList = workouts ?? []
  const workoutDates = new Set(workoutList.map((w) => w.date))

  const thisWeek = workoutList.filter((w) => {
    const d = parseISO(w.date)
    return d >= weekStart && d < addDays(weekStart, 7)
  })

  const todayWorkout = workoutList.find((w) => w.date === today)
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
    if (!workoutDates.has(format(cursor, 'yyyy-MM-dd'))) cursor = subDays(cursor, 1)
    while (workoutDates.has(format(cursor, 'yyyy-MM-dd'))) {
      count++
      cursor = subDays(cursor, 1)
    }
    return count
  })()

  const nextMilestone = streak > 0 ? Math.ceil(streak / 7) * 7 : 7
  const daysToMilestone = Math.max(0, nextMilestone - streak)

  const goalMl = goals?.dailyWaterMl && goals.dailyWaterMl > 0 ? goals.dailyWaterMl : DEFAULT_WATER_GOAL_ML
  const todayWater = (waterLogs ?? [])
    .filter((l) => l.date === today)
    .reduce((s, l) => s + l.amountMl, 0)
  const waterPct = Math.round(waterProgress(todayWater, goalMl) * 100)

  const last3WaterDays = [2, 1, 0].map((i) => {
    const d = subDays(new Date(), i)
    const key = format(d, 'yyyy-MM-dd')
    const ml = (waterLogs ?? []).filter((l) => l.date === key).reduce((s, l) => s + l.amountMl, 0)
    return { key, label: format(d, 'MMM d'), ml }
  })
  const maxWater3 = Math.max(goalMl, ...last3WaterDays.map((d) => d.ml), 1)

  const recentWorkouts = [...workoutList]
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)

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

  const focusMusclesList: MuscleGroup[] = (() => {
    if (todayWorkout?.exercises.length) {
      return [...new Set(todayWorkout.exercises.map((e) => e.muscle))] as MuscleGroup[]
    }
    return todayPlan?.muscles ?? []
  })()

  const focusTitle = todayWorkout?.title ?? (
    todayPlan && todayPlan.muscles.length > 0
      ? todayPlan.title
      : 'Strength & muscle growth'
  )

  const focusMusclesText: string = (() => {
    if (focusMusclesList.length) {
      return focusMusclesList.map((g) => MUSCLE_LABELS[g]).join(' · ')
    }
    return 'Pick exercises in Log'
  })()

  const focusRegion = focusRegionLabel(focusMusclesList)

  const focusImage = (() => {
    const ex = todayWorkout?.exercises[0]
    if (ex) return { muscle: ex.muscle, imageKey: ex.imageKey }
    const muscle = focusMusclesList[0] ?? 'chest'
    const name = todayPlan?.exerciseNames[0]
    return {
      muscle,
      imageKey: name ? imageKeyForExercise(name, muscle) : imageKeyForExercise('Barbell Bench Press', 'chest'),
    }
  })()

  const checklist = [
    { label: 'Complete workout', done: Boolean(todayWorkout) },
    { label: `Drink ${formatWater(goalMl)} water`, done: todayWater >= goalMl },
    { label: 'Maintain protein intake', done: false },
  ]

  return (
    <div className="home-premium mx-auto flex max-w-lg flex-col lg:max-w-xl">
      <header className="home-premium-header flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="home-avatar" aria-hidden>
            {user?.name ? initials(user.name) : '?'}
          </div>
          <div className="min-w-0">
            <h1 className="home-premium-title truncate">
              {greeting()}, {firstName} 👋
            </h1>
            <p className="home-premium-sub">{goals?.focus || 'Stay consistent, stronger every day'}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="home-icon-btn" aria-label="Notifications">
            <Bell size={17} />
          </button>
          <ThemeToggle />
          <Link to="/settings" className="home-icon-btn" aria-label="Settings">
            <Settings size={17} />
          </Link>
        </div>
      </header>

      <section className="home-card">
        <Link to="/history" className="home-card-head-link">
          <span className="home-card-head-left">
            <span className="home-card-icon home-card-icon--accent">
              <Flame size={18} />
            </span>
            <span className="home-card-head-title">Weekly streak</span>
          </span>
          <ChevronRight size={18} className="home-card-head-chevron" />
        </Link>
        <p className="home-card-stat mt-2">
          {streak} <span className="home-card-stat-unit">days</span>
        </p>
        <p className="home-card-hint">
          {daysToMilestone > 0
            ? `Keep going! ${daysToMilestone} more day${daysToMilestone === 1 ? '' : 's'} to reach your next milestone.`
            : `${thisWeek.length}/${weeklyGoal} workouts logged this week.`}
        </p>
        <div className="home-week-row">
          {weekDays.map((d) => {
            const key = format(d, 'yyyy-MM-dd')
            const hit = workoutDates.has(key)
            const isToday = isSameDay(d, new Date())
            return (
              <div key={key} className="home-week-cell" title={format(d, 'EEE, MMM d')}>
                <span className="home-week-label">{format(d, 'EEE').slice(0, 3)}</span>
                <span
                  className={`home-week-dot ${hit ? 'home-week-dot--done' : ''} ${isToday ? 'home-week-dot--today' : ''}`}
                >
                  {hit ? <Check size={11} strokeWidth={3} /> : null}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="home-card">
        <div className="home-water-grid">
          <div className="min-w-0">
            <Link to="/water" className="home-card-head-link mb-2">
              <span className="home-card-head-left">
                <Droplets size={17} className="text-[var(--home-blue)]" />
                <span className="home-card-head-title">Water intake</span>
              </span>
              <ChevronRight size={18} className="home-card-head-chevron" />
            </Link>
            <p className="home-card-stat home-card-stat--sm">
              {litersCompact(todayWater)} / {litersCompact(goalMl)} L
            </p>
            <p className="home-card-hint">{waterPct}% of daily goal</p>
            <div className="home-progress mt-2.5">
              <div className="home-progress-fill" style={{ width: `${Math.max(waterPct, 3)}%` }} />
            </div>
            <button
              type="button"
              className="home-water-add mt-3 w-full"
              onClick={() => quickAddWater(250)}
            >
              <Plus size={17} strokeWidth={2.5} /> Add water
            </button>
          </div>
          <div className="home-water-chart">
            <p className="home-chart-title">Last 3 days</p>
            <div className="home-water-bars">
              {last3WaterDays.map((row) => (
                <div key={row.key} className="home-water-bar-col">
                  <span className="home-water-bar-value">{litersCompact(row.ml)}L</span>
                  <div
                    className="home-water-bar"
                    style={{ height: `${Math.max(10, (row.ml / maxWater3) * 100)}%` }}
                    title={formatWater(row.ml)}
                  />
                  <span className="home-water-bar-label">{row.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-card home-card--focus">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target size={17} className="text-[var(--home-red)]" />
            <span className="home-card-head-title">Today&apos;s focus</span>
          </div>
          <span className="home-date-badge">
            <Calendar size={12} />
            {format(new Date(), 'EEE, MMM d, yyyy')}
          </span>
        </div>

        <div className="home-focus-panel mt-3">
          <div className="home-focus-thumb">
            <ExerciseImage
              muscle={focusImage.muscle}
              imageKey={focusImage.imageKey}
              size="sm"
              className="h-full w-full"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="home-focus-tag">{focusRegion}</span>
            <p className="home-focus-title">{focusTitle}</p>
            <p className="home-card-hint mt-0.5">{focusMusclesText}</p>
          </div>
          {todayWorkout ? (
            <Link to={`/history/${todayWorkout.id}`} className="home-start-btn">
              View <ChevronRight size={16} />
            </Link>
          ) : (
            <Link to={logHref} className="home-start-btn">
              Start <ChevronRight size={16} />
            </Link>
          )}
        </div>

        <ul className="home-checklist-row mt-3">
          {checklist.map((item) => (
            <li key={item.label} className="home-checklist-chip">
              <span className={`home-check ${item.done ? 'home-check--done' : ''}`}>
                {item.done ? <Check size={10} strokeWidth={3} /> : null}
              </span>
              <span className="truncate">{item.label}</span>
            </li>
          ))}
        </ul>
        {!todayWorkout && !activePlan && (
          <Link to="/plans" className="home-inline-link mt-2 inline-block">
            Set up a weekly plan →
          </Link>
        )}
      </section>

      {recentWorkouts.length > 0 && (
        <section className="home-card home-card--history">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Dumbbell size={16} className="shrink-0 text-[var(--home-muted)]" />
              <span className="home-card-head-title truncate">Last 3 days workout summary</span>
            </div>
            <Link to="/history" className="home-view-all">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <ul className="home-workout-list mt-2">
            {recentWorkouts.map((w) => {
              const d = parseISO(w.date)
              const muscle = primaryMuscle(w) ?? w.exercises[0]?.muscle ?? 'full'
              const imageKey =
                w.exercises[0]?.imageKey ??
                imageKeyForExercise(w.exercises[0]?.exerciseName ?? 'Workout', muscle)
              return (
                <li key={w.id}>
                  <Link to={`/history/${w.id}`} className="home-workout-row">
                    <div className="home-workout-date">
                      <span className="home-workout-date-main">{format(d, 'MMM d')}</span>
                      <span className="home-workout-date-sub">{format(d, 'EEE')}</span>
                    </div>
                    <div className="home-workout-thumb">
                      <ExerciseImage
                        muscle={muscle}
                        imageKey={imageKey}
                        size="sm"
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="home-workout-title truncate">{w.title}</p>
                      <p className="home-workout-meta">
                        <Clock3 size={11} />
                        {w.durationMin} min
                        <span className="home-workout-meta-sep" />
                        <Dumbbell size={11} />
                        {w.exercises.length} exercises
                        <span className="home-workout-meta-sep" />
                        <Flame size={11} />
                        {estKcal(w.durationMin)} kcal
                      </p>
                    </div>
                    <span className="home-badge-done">Completed</span>
                    <ChevronRight size={16} className="home-row-chevron shrink-0" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
