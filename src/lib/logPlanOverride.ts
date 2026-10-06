import type { Weekday } from '../data/plans'

const KEY_PREFIX = 'pulse-log-plan-weekday'

function storageKey(userId: number, date: string) {
  return `${KEY_PREFIX}:${userId}:${date}`
}

/** Per log date: which weekday of the active plan to use (overrides calendar). */
export function readLogPlanWeekdayOverride(userId: number, date: string): Weekday | null {
  try {
    const raw = localStorage.getItem(storageKey(userId, date))
    if (raw == null) return null
    const n = Number(raw)
    if (n >= 0 && n <= 6) return n as Weekday
  } catch {
    /* ignore */
  }
  return null
}

export function saveLogPlanWeekdayOverride(userId: number, date: string, weekday: Weekday) {
  try {
    localStorage.setItem(storageKey(userId, date), String(weekday))
  } catch {
    /* ignore */
  }
}

export function clearLogPlanWeekdayOverride(userId: number, date: string) {
  try {
    localStorage.removeItem(storageKey(userId, date))
  } catch {
    /* ignore */
  }
}
