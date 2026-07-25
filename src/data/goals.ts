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

export function normalizeFocus(value: string | null | undefined): FocusOption {
  if (value && (FOCUS_OPTIONS as readonly string[]).includes(value)) {
    return value as FocusOption
  }
  return DEFAULT_FOCUS
}
