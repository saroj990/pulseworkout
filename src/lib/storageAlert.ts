import { subMonths, format, parseISO } from 'date-fns'
import { db } from '../db'

export interface OldDataSummary {
  hasOldData: boolean
  oldestDate: string | null
  workoutCount: number
  waterCount: number
}

/** Find records older than 6 months for this user. */
export async function getOldDataSummary(userId: number): Promise<OldDataSummary> {
  const cutoff = format(subMonths(new Date(), 6), 'yyyy-MM-dd')

  const [workouts, water] = await Promise.all([
    db.workouts.where('userId').equals(userId).filter((w) => w.date < cutoff).toArray(),
    db.waterLogs.where('userId').equals(userId).filter((w) => w.date < cutoff).toArray(),
  ])

  const dates = [...workouts.map((w) => w.date), ...water.map((w) => w.date)].sort()
  const oldestDate = dates[0] ?? null

  return {
    hasOldData: workouts.length > 0 || water.length > 0,
    oldestDate,
    workoutCount: workouts.length,
    waterCount: water.length,
  }
}

export function formatOldestLabel(oldestDate: string | null): string {
  if (!oldestDate) return ''
  try {
    return format(parseISO(oldestDate), 'MMM d, yyyy')
  } catch {
    return oldestDate
  }
}
