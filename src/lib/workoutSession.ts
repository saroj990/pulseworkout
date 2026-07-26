import type { WorkoutExercise } from '../db'

const SESSION_KEY = 'pulse_active_workout_session'

/** Mandatory rest between exercises while a session is running */
export const BETWEEN_EXERCISE_REST_SEC = 60

export type WorkoutSessionState = {
  userId: number
  startedAt: number
  durationMin: number
  title: string
  date: string
  notes: string
  exercises: WorkoutExercise[]
  /** Index of the exercise in focus */
  focusIndex: number
  /** Absolute timestamp when inter-exercise rest ends */
  restEndsAt: number | null
  /** When the session clock was paused (null = running) */
  pausedAt: number | null
  /** Total ms spent paused (excludes current pause) */
  pausedMs: number
  /** When the “complete?” prompt was first shown */
  promptShownAt: number | null
  /** User dismissed the prompt without confirming */
  promptDismissed: boolean
}

export function loadWorkoutSession(userId: number): WorkoutSessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkoutSessionState
    if (parsed.userId !== userId || !parsed.startedAt) return null
    return {
      ...parsed,
      focusIndex: parsed.focusIndex ?? 0,
      restEndsAt: parsed.restEndsAt ?? null,
      pausedAt: parsed.pausedAt ?? null,
      pausedMs: parsed.pausedMs ?? 0,
    }
  } catch {
    return null
  }
}

export function saveWorkoutSession(session: WorkoutSessionState) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearWorkoutSession() {
  localStorage.removeItem(SESSION_KEY)
}

/** Seconds after planned end before asking to complete */
export const PROMPT_GRACE_SEC = 10 * 60
/** Seconds after the prompt before force-completing */
export const AUTO_COMPLETE_AFTER_PROMPT_SEC = 20 * 60

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** Elapsed workout seconds, excluding paused time. */
export function sessionElapsedSec(session: WorkoutSessionState, now: number): number {
  const end = session.pausedAt ?? now
  return Math.max(0, Math.floor((end - session.startedAt - session.pausedMs) / 1000))
}

export function isExerciseDone(ex: WorkoutExercise): boolean {
  return ex.sets.length > 0 && ex.sets.every((s) => s.completed)
}
