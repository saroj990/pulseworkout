import { useEffect, useState } from 'react'
import { WEEKDAY_FULL, WEEKDAY_LABELS, type Weekday } from '../data/plans'

type Props = {
  open: boolean
  workoutTitle: string
  exerciseCount: number
  initialWeekday: Weekday
  busy?: boolean
  onClose: () => void
  onConfirm: (weekday: Weekday) => void
}

export function SaveWorkoutToPlanModal({
  open,
  workoutTitle,
  exerciseCount,
  initialWeekday,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const [weekday, setWeekday] = useState<Weekday>(initialWeekday)

  useEffect(() => {
    if (open) setWeekday(initialWeekday)
  }, [open, initialWeekday])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 px-4 pb-6 sm:items-center">
      <div
        className="w-full max-w-sm rounded-[var(--radius)] bg-white p-5 shadow-xl animate-fade-up"
        role="dialog"
        aria-labelledby="save-plan-title"
      >
        <h3 id="save-plan-title" className="font-display text-lg font-bold">Save to weekly plan</h3>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--ink)]">{workoutTitle}</span>
          {' · '}
          {exerciseCount} exercises
        </p>
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
          Assign to
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((wd) => (
            <button
              key={wd}
              type="button"
              className={`rounded-xl py-2 text-center text-[0.65rem] font-bold ${
                weekday === wd
                  ? 'bg-[var(--brand)] text-white'
                  : 'border border-[var(--line)] bg-white'
              }`}
              onClick={() => setWeekday(wd)}
            >
              {WEEKDAY_LABELS[wd]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--ink-muted)]">
          Updates {WEEKDAY_FULL[weekday]} on your active plan.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" className="btn btn-secondary w-full" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={() => onConfirm(weekday)}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
