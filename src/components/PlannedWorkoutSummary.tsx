import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronRight, Clock3, Dumbbell } from 'lucide-react'
import type { Workout } from '../db'

export type PlannedDay = {
  label: string
  date: string
  workout?: Workout
  logHref: string
}

function PlannedRowApp({ day }: { day: PlannedDay }) {
  const { label, date, workout, logHref } = day
  return (
    <div className="surface-elevated rounded-xl px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
            {label}
          </p>
          <p className="text-xs font-semibold text-[var(--ink-muted)]">
            {format(parseISO(date), 'EEE, MMM d')}
          </p>
          {workout ? (
            <>
              <p className="mt-1 truncate font-bold text-[var(--ink)]">{workout.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs font-semibold text-[var(--ink-muted)]">
                <Clock3 size={11} />
                {workout.durationMin} min
                <span aria-hidden>·</span>
                <Dumbbell size={11} />
                {workout.exercises.length} exercises
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-[var(--ink-muted)]">No workout planned</p>
          )}
        </div>
        {workout ? (
          <Link
            to={logHref}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-[var(--brand)] hover:bg-[var(--brand-soft)]"
          >
            Edit
          </Link>
        ) : (
          <Link
            to={logHref}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-[var(--brand)] hover:bg-[var(--brand-soft)]"
          >
            Plan
          </Link>
        )}
      </div>
    </div>
  )
}

function PlannedRowHome({ day }: { day: PlannedDay }) {
  const { label, date, workout, logHref } = day
  return (
    <Link to={logHref} className="home-planned-row">
      <div className="min-w-0 flex-1">
        <p className="home-planned-label">
          {label} · {format(parseISO(date), 'EEE, MMM d')}
        </p>
        {workout ? (
          <>
            <p className="home-planned-title truncate">{workout.title}</p>
            <p className="home-planned-meta">
              <Clock3 size={11} />
              {workout.durationMin} min
              <span className="home-workout-meta-sep" />
              <Dumbbell size={11} />
              {workout.exercises.length} exercises
            </p>
          </>
        ) : (
          <p className="home-planned-empty">No workout planned</p>
        )}
      </div>
      {workout ? <span className="home-badge-planned">Planned</span> : null}
      <ChevronRight size={16} className="home-row-chevron shrink-0" />
    </Link>
  )
}

export function PlannedWorkoutSummary({
  days,
  variant = 'app',
  className = '',
}: {
  days: PlannedDay[]
  variant?: 'home' | 'app'
  className?: string
}) {
  if (variant === 'home') {
    return (
      <div className={`home-planned-list ${className}`.trim()}>
        {days.map((day) => (
          <PlannedRowHome key={day.date} day={day} />
        ))}
      </div>
    )
  }

  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${className}`.trim()}>
      {days.map((day) => (
        <PlannedRowApp key={day.date} day={day} />
      ))}
    </div>
  )
}
