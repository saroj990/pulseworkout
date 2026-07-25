import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO, subDays } from 'date-fns'
import { Droplets, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { db } from '../db'
import { ProgressRing } from '../components/ProgressRing'
import { parseNumeric, sanitizeNumericInput, toNumericString } from '../lib/numeric'
import {
  DEFAULT_WATER_GOAL_ML,
  WATER_QUICK_ADDS_ML,
  formatWater,
  waterProgress,
} from '../lib/water'

export function WaterPage() {
  const { user, goals, updateGoals } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const goalMl = goals?.dailyWaterMl && goals.dailyWaterMl > 0 ? goals.dailyWaterMl : DEFAULT_WATER_GOAL_ML

  const [customAmount, setCustomAmount] = useState('0')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const logs = useLiveQuery(async () => {
    if (!user?.id) return []
    const list = await db.waterLogs.where('userId').equals(user.id).toArray()
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [user?.id])

  const todayLogs = useMemo(
    () => (logs ?? []).filter((l) => l.date === today),
    [logs, today],
  )

  const todayTotal = useMemo(
    () => todayLogs.reduce((sum, l) => sum + l.amountMl, 0),
    [todayLogs],
  )

  const recentDays = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of logs ?? []) {
      map.set(log.date, (map.get(log.date) ?? 0) + log.amountMl)
    }
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
      return { date, total: map.get(date) ?? 0 }
    })
  }, [logs])

  async function addWater(amountMl: number) {
    if (!user?.id) return
    if (!Number.isFinite(amountMl) || amountMl <= 0) {
      setError('Enter an amount greater than 0.')
      return
    }
    if (amountMl > 5000) {
      setError('Single entry can’t be more than 5000 ml.')
      return
    }
    setBusy(true)
    setError('')
    try {
      // Backfill goal for older accounts
      if (goals?.id && (goals.dailyWaterMl == null || goals.dailyWaterMl <= 0)) {
        await updateGoals({ dailyWaterMl: DEFAULT_WATER_GOAL_ML })
      }
      await db.waterLogs.add({
        userId: user.id,
        date: today,
        amountMl: Math.round(amountMl),
        createdAt: new Date().toISOString(),
      })
      setCustomAmount('0')
    } finally {
      setBusy(false)
    }
  }

  async function removeLog(id?: number) {
    if (!id) return
    await db.waterLogs.delete(id)
  }

  const progress = waterProgress(todayTotal, goalMl)

  return (
    <div className="space-y-5">
      <header className="animate-fade-up">
        <p className="text-sm font-bold text-[var(--brand)]">Hydration</p>
        <h1 className="page-title">Water</h1>
        <p className="page-subtitle">Log glasses through the day. Saved on this device.</p>
      </header>

      <section
        className="glass animate-fade-up rounded-[var(--radius)] p-5 shadow-[var(--shadow)]"
        style={{ animationDelay: '40ms' }}
      >
        <div className="flex items-center gap-5">
          <ProgressRing
            value={progress}
            label={formatWater(todayTotal)}
            sublabel={`of ${formatWater(goalMl)}`}
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold">Today</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {todayTotal >= goalMl
                ? 'Goal reached — nice work.'
                : `${formatWater(Math.max(goalMl - todayTotal, 0))} left to goal`}
            </p>
            <Link to="/goals" className="mt-3 inline-block text-sm font-bold text-[var(--brand)]">
              Change daily goal
            </Link>
          </div>
        </div>
      </section>

      <section className="animate-fade-up space-y-3" style={{ animationDelay: '70ms' }}>
        <h2 className="font-display text-lg font-bold">Quick add</h2>
        <div className="grid grid-cols-3 gap-2">
          {WATER_QUICK_ADDS_ML.map((ml) => (
            <button
              key={ml}
              type="button"
              className="btn btn-secondary py-3"
              disabled={busy}
              onClick={() => addWater(ml)}
            >
              <Plus size={14} />
              {ml} ml
            </button>
          ))}
        </div>

        <div className="glass rounded-[var(--radius)] p-4 space-y-3">
          <label className="label" htmlFor="custom-water">
            Custom amount (ml)
          </label>
          <div className="flex gap-2">
            <input
              id="custom-water"
              className="input"
              type="text"
              inputMode="numeric"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(sanitizeNumericInput(e.target.value))
                setError('')
              }}
              onBlur={() => setCustomAmount(toNumericString(customAmount, '0'))}
            />
            <button
              type="button"
              className="btn btn-primary shrink-0 px-4"
              disabled={busy}
              onClick={() => addWater(parseNumeric(customAmount, 0))}
            >
              Add
            </button>
          </div>
          {error && (
            <p className="text-xs font-semibold text-[var(--danger)]">{error}</p>
          )}
        </div>
      </section>

      <section className="animate-fade-up space-y-3" style={{ animationDelay: '100ms' }}>
        <h2 className="font-display text-lg font-bold">Today’s entries</h2>
        {todayLogs.length === 0 ? (
          <div className="glass rounded-[var(--radius)] p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Droplets size={20} />
            </div>
            <p className="mt-3 font-bold">No water logged yet</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Tap a quick amount to start.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {todayLogs.map((log) => (
              <li
                key={log.id}
                className="glass flex items-center gap-3 rounded-2xl px-3 py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <Droplets size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{formatWater(log.amountMl)}</p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {format(parseISO(log.createdAt), 'h:mm a')}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost p-2 text-[var(--danger)]"
                  aria-label="Remove entry"
                  onClick={() => removeLog(log.id)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="animate-fade-up space-y-3" style={{ animationDelay: '130ms' }}>
        <h2 className="font-display text-lg font-bold">Last 7 days</h2>
        <div className="glass rounded-[var(--radius)] p-3 space-y-2">
          {recentDays.map((day) => {
            const pct = waterProgress(day.total, goalMl)
            const isToday = day.date === today
            return (
              <div key={day.date} className="flex items-center gap-3">
                <p className="w-16 shrink-0 text-xs font-bold text-[var(--ink-muted)]">
                  {isToday ? 'Today' : format(parseISO(day.date), 'EEE')}
                </p>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white border border-[var(--line)]">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all"
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
                <p className="w-14 shrink-0 text-right text-xs font-bold">
                  {day.total > 0 ? formatWater(day.total) : '—'}
                </p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/** Compact widget used on the dashboard */
export function WaterQuickCard() {
  const { user, goals } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const goalMl = goals?.dailyWaterMl && goals.dailyWaterMl > 0 ? goals.dailyWaterMl : DEFAULT_WATER_GOAL_ML

  const todayTotal = useLiveQuery(async () => {
    if (!user?.id) return 0
    const list = await db.waterLogs
      .where('userId')
      .equals(user.id)
      .filter((l) => l.date === today)
      .toArray()
    return list.reduce((sum, l) => sum + l.amountMl, 0)
  }, [user?.id, today])

  const total = todayTotal ?? 0
  const progress = waterProgress(total, goalMl)

  async function quickAdd(ml: number) {
    if (!user?.id) return
    await db.waterLogs.add({
      userId: user.id,
      date: today,
      amountMl: ml,
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <section className="glass animate-fade-up rounded-[var(--radius)] p-4" style={{ animationDelay: '85ms' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Water</p>
          <p className="mt-1 font-display text-xl font-bold">
            {formatWater(total)}
            <span className="ml-1 text-sm font-bold text-[var(--ink-muted)]">
              / {formatWater(goalMl)}
            </span>
          </p>
        </div>
        <Link to="/water" className="text-sm font-bold text-[var(--brand)]">
          Open
        </Link>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white border border-[var(--line)]">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-secondary flex-1 py-2 text-sm" onClick={() => quickAdd(250)}>
          <Plus size={14} /> 250
        </button>
        <button type="button" className="btn btn-secondary flex-1 py-2 text-sm" onClick={() => quickAdd(500)}>
          <Plus size={14} /> 500
        </button>
        <Link to="/water" className="btn btn-primary flex-1 py-2 text-sm">
          More
        </Link>
      </div>
    </section>
  )
}
