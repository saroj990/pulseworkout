export const FOCUS_OPTIONS = [
  'Build consistency',
  'Get stronger',
  'Build muscle',
  'Lose fat',
  'Improve endurance',
  'Stay active',
  'Rehab & mobility',
] as const

export type FocusOption = (typeof FOCUS_OPTIONS)[number]

export const DEFAULT_FOCUS: FocusOption = 'Build consistency'
export const DEFAULT_WEEKLY_WORKOUTS = 5
export const DEFAULT_DAILY_MINUTES = 60
export const DEFAULT_REST_SECONDS = 60

export function normalizeFocus(value: string | null | undefined): FocusOption {
  if (value && (FOCUS_OPTIONS as readonly string[]).includes(value)) {
    return value as FocusOption
  }
  return DEFAULT_FOCUS
}

/** Prefer a stored positive value; otherwise the sane default. */
export function positiveOrDefault(
  value: number | null | undefined,
  fallback: number,
): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : fallback
}
