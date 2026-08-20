/** Keep only digits and at most one decimal point. */
export function sanitizeNumericInput(raw: string, allowDecimal = false): string {
  const cleaned = allowDecimal
    ? raw.replace(/[^\d.]/g, '')
    : raw.replace(/\D/g, '')
  if (!allowDecimal) return cleaned
  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join('')}`
}

export function toNumericString(value: number | string | null | undefined, fallback = '0'): string {
  if (value == null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return String(n)
}

export function parseNumeric(value: string, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** On focus, clear a lone zero so the user can type a new value immediately. */
export function clearZeroOnFocus(value: string, setValue: (next: string) => void) {
  if (value === '0' || value === '0.0') setValue('')
}

/** On blur, if empty/zero, restore a positive default. */
export function blurToPositiveDefault(
  value: string,
  setValue: (next: string) => void,
  fallback: number,
) {
  const n = parseNumeric(value, 0)
  setValue(String(n > 0 ? n : fallback))
}
