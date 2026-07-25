import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Check, Pencil, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { db, type MuscleGroup, type UserPlan } from '../db'
import { MUSCLE_LABELS } from '../data/exercises'
import {
  PLAN_TEMPLATES,
  PART_WORKOUTS,
  WEEKDAY_FULL,
  WEEKDAY_LABELS,
  buildDayFromMuscles,
  emptyCustomWeek,
  type PlanDay,
  type PlanTemplate,
  type Weekday,
} from '../data/plans'

const MUSCLE_OPTIONS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'cardio',
  'full',
]

export function PlansPage() {
  const { user } = useAuth()
  const [mode, setMode] = useState<'browse' | 'custom' | 'parts'>('browse')
  const [customDays, setCustomDays] = useState<PlanDay[]>(emptyCustomWeek())
  const [customName, setCustomName] = useState('My split')
  const [editingWeekday, setEditingWeekday] = useState<Weekday | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const activePlan = useLiveQuery(async () => {
    if (!user?.id) return undefined
    return db.userPlans.where('userId').equals(user.id).filter((p) => p.active).first()
  }, [user?.id])

  async function activateTemplate(template: PlanTemplate) {
    if (!user?.id) return
    setBusy(true)
    setMessage('')
    try {
      await db.transaction('rw', db.userPlans, async () => {
        const existing = await db.userPlans.where('userId').equals(user.id!).toArray()
        for (const p of existing) {
          if (p.id) await db.userPlans.update(p.id, { active: false })
        }
        await db.userPlans.add({
          userId: user.id!,
          templateId: template.id,
          name: template.name,
          days: template.days.map((d) => ({ ...d, muscles: [...d.muscles], exerciseNames: [...d.exerciseNames] })),
          active: true,
          updatedAt: new Date().toISOString(),
        })
      })
      setMessage(`“${template.name}” is now your active plan.`)
      setMode('browse')
    } finally {
      setBusy(false)
    }
  }

  async function saveCustomPlan() {
    if (!user?.id) return
    setBusy(true)
    setMessage('')
    try {
      const days = customDays.map((d) => {
        if (d.muscles.length === 0) {
          return { ...d, title: 'Rest', exerciseNames: [] }
        }
        const built = buildDayFromMuscles(d.muscles)
        return { ...d, title: built.title, exerciseNames: built.exerciseNames }
      })

      await db.transaction('rw', db.userPlans, async () => {
        const existing = await db.userPlans.where('userId').equals(user.id!).toArray()
        for (const p of existing) {
          if (p.id) await db.userPlans.update(p.id, { active: false })
        }
        await db.userPlans.add({
          userId: user.id!,
          templateId: 'custom',
          name: customName.trim() || 'My split',
          days,
          active: true,
          updatedAt: new Date().toISOString(),
        })
      })
      setMessage('Custom plan saved and activated.')
      setMode('browse')
    } finally {
      setBusy(false)
    }
  }

  function startCustomFromActive() {
    if (activePlan) {
      setCustomDays(
        ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => {
          const found = activePlan.days.find((d) => d.weekday === weekday)
          return found
            ? {
                weekday,
                muscles: [...found.muscles],
                title: found.title,
                exerciseNames: [...found.exerciseNames],
              }
            : { weekday, muscles: [], title: 'Rest', exerciseNames: [] }
        }),
      )
      setCustomName(activePlan.name)
    } else {
      setCustomDays(emptyCustomWeek())
      setCustomName('My split')
    }
    setMode('custom')
  }

  function toggleMuscleForDay(weekday: Weekday, muscle: MuscleGroup) {
    setCustomDays((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d
        const has = d.muscles.includes(muscle)
        const muscles = has ? d.muscles.filter((m) => m !== muscle) : [...d.muscles, muscle]
        const built = buildDayFromMuscles(muscles)
        return {
          ...d,
          muscles,
          title: built.title,
          exerciseNames: built.exerciseNames,
        }
      }),
    )
  }

  const editingDay = editingWeekday != null ? customDays.find((d) => d.weekday === editingWeekday) : null

  return (
    <div className="space-y-5">
      <header className="animate-fade-up">
        <h1 className="page-title">Plans</h1>
        <p className="page-subtitle">
          Pick a ready-made split or assign body parts to each day.
        </p>
      </header>

      {activePlan && mode === 'browse' && <ActivePlanCard plan={activePlan} />}

      <div className="flex gap-1.5 overflow-x-auto pb-1 animate-fade-up sm:gap-2">
        {(
          [
            { id: 'browse', label: 'Templates' },
            { id: 'custom', label: 'Custom days' },
            { id: 'parts', label: 'By part' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (tab.id === 'custom') startCustomFromActive()
              else setMode(tab.id)
            }}
            className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs font-bold sm:px-3 sm:text-sm ${
              mode === tab.id
                ? 'bg-[var(--brand)] text-white'
                : 'bg-white border border-[var(--line)] text-[var(--ink-muted)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <p className="rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand)]">
          {message}
        </p>
      )}

      {mode === 'browse' && (
        <div className="space-y-3">
          {PLAN_TEMPLATES.map((t, i) => (
            <article
              key={t.id}
              className="glass animate-slide-in rounded-[var(--radius)] p-4"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold">{t.name}</h2>
                    <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--brand)]">
                      {t.tag}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">{t.description}</p>
                </div>
                {activePlan?.templateId === t.id && (
                  <span className="flex items-center gap-1 text-xs font-bold text-[var(--brand)]">
                    <Check size={14} /> Active
                  </span>
                )}
              </div>
              <div className="week-strip mt-3">
                {t.days.map((d) => (
                  <div
                    key={d.weekday}
                    className={`week-day ${
                      d.muscles.length === 0
                        ? 'border border-[var(--line)] bg-white text-[var(--ink-muted)]'
                        : 'bg-[var(--brand)] text-white'
                    }`}
                    title={d.muscles.length === 0 ? 'Rest' : d.title}
                  >
                    <p className="week-day__name">{WEEKDAY_LABELS[d.weekday]}</p>
                    <p className="week-day__focus">
                      {d.muscles.length === 0 ? 'Rest' : d.title.split(/[\s+/]/)[0]}
                    </p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-primary mt-4 w-full"
                disabled={busy || activePlan?.templateId === t.id}
                onClick={() => activateTemplate(t)}
              >
                {activePlan?.templateId === t.id ? 'Currently active' : 'Use this plan'}
              </button>
            </article>
          ))}
        </div>
      )}

      {mode === 'custom' && (
        <div className="space-y-4 animate-fade-up">
          <div className="glass rounded-[var(--radius)] p-4">
            <label className="label" htmlFor="plan-name">
              Plan name
            </label>
            <input
              id="plan-name"
              className="input"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>

          <p className="text-sm text-[var(--ink-muted)]">
            Tap a day to choose which body part(s) to train. Workouts fill in automatically.
          </p>

          <div className="space-y-2">
            {customDays.map((d) => (
              <button
                key={d.weekday}
                type="button"
                onClick={() => setEditingWeekday(d.weekday)}
                className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left"
              >
                <div
                  className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl text-xs font-extrabold ${
                    d.muscles.length
                      ? 'bg-[var(--brand)] text-white'
                      : 'bg-white border border-[var(--line)] text-[var(--ink-muted)]'
                  }`}
                >
                  {WEEKDAY_LABELS[d.weekday]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{WEEKDAY_FULL[d.weekday]}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">
                    {d.muscles.length === 0
                      ? 'Rest day'
                      : `${d.title} · ${d.exerciseNames.length} exercises`}
                  </p>
                </div>
                <Pencil size={16} className="text-[var(--ink-muted)]" />
              </button>
            ))}
          </div>

          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={saveCustomPlan}>
            {busy ? 'Saving…' : 'Save & activate custom plan'}
          </button>
        </div>
      )}

      {mode === 'parts' && (
        <div className="space-y-3 animate-fade-up">
          <p className="text-sm text-[var(--ink-muted)]">
            Ready-made workouts for each body part — start one anytime.
          </p>
          {MUSCLE_OPTIONS.map((m, i) => {
            const part = PART_WORKOUTS[m]
            return (
              <div
                key={m}
                className="glass animate-slide-in rounded-[var(--radius)] p-4"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">{MUSCLE_LABELS[m]}</h2>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
                      {part.exerciseNames.join(' · ')}
                    </p>
                  </div>
                  <Link
                    to={`/log?part=${m}`}
                    className="btn btn-accent shrink-0 px-3 py-2 text-sm"
                  >
                    Start
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editingWeekday != null && editingDay && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-[1.5rem] bg-[var(--bg)] p-5 sm:rounded-[var(--radius)]">
            <h3 className="font-display text-xl font-bold">
              {WEEKDAY_FULL[editingWeekday]}
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Select one or more parts — or none for rest.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {MUSCLE_OPTIONS.map((m) => {
                const on = editingDay.muscles.includes(m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMuscleForDay(editingWeekday, m)}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                      on
                        ? 'bg-[var(--brand)] text-white'
                        : 'bg-white border border-[var(--line)]'
                    }`}
                  >
                    {MUSCLE_LABELS[m]}
                  </button>
                )
              })}
            </div>
            {editingDay.muscles.length > 0 && (
              <p className="mt-4 text-xs text-[var(--ink-muted)]">
                <Sparkles size={12} className="mr-1 inline" />
                Includes: {editingDay.exerciseNames.join(', ')}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary mt-5 w-full"
              onClick={() => setEditingWeekday(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ActivePlanCard({ plan }: { plan: UserPlan }) {
  const today = useMemo(() => {
    const weekday = new Date().getDay() as Weekday
    return plan.days.find((d) => d.weekday === weekday)
  }, [plan.days])

  const isRest = !today || today.muscles.length === 0

  return (
    <section
      className="glass animate-fade-up rounded-[var(--radius)] shadow-[var(--shadow)]"
      style={{ padding: 'var(--card-pad)' }}
    >
      <div className="flex items-center gap-2 text-[var(--brand)]">
        <CalendarDays size={16} className="sm:h-[18px] sm:w-[18px]" />
        <p className="text-[0.65rem] font-bold uppercase tracking-wider sm:text-xs">Active plan</p>
      </div>
      <h2 className="mt-1 font-display text-lg font-bold sm:text-xl">{plan.name}</h2>

      <div className="week-strip mt-3">
        {plan.days
          .slice()
          .sort((a, b) => a.weekday - b.weekday)
          .map((d) => {
            const isToday = d.weekday === new Date().getDay()
            const focus = d.muscles.length === 0 ? '—' : d.title.split(/[\s+/]/)[0]
            return (
              <div
                key={d.weekday}
                className={`week-day ${isToday ? 'week-day--today' : ''} ${
                  d.muscles.length
                    ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                    : 'border border-[var(--line)] bg-white text-[var(--ink-muted)]'
                }`}
                title={d.muscles.length ? d.title : 'Rest'}
              >
                <div className="week-day__name">{WEEKDAY_LABELS[d.weekday]}</div>
                <div className="week-day__focus">{focus}</div>
              </div>
            )
          })}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold sm:text-base">Today: {isRest ? 'Rest' : today.title}</p>
          {!isRest && (
            <p className="text-[0.7rem] text-[var(--ink-muted)] sm:text-xs">
              {today.exerciseNames.length} exercises ready
            </p>
          )}
        </div>
        {!isRest && (
          <Link to="/log?fromPlan=1" className="btn btn-accent w-full shrink-0 px-3 py-2 text-sm sm:w-auto">
            Start today
          </Link>
        )}
      </div>
    </section>
  )
}
