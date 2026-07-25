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
