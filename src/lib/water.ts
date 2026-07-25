export const DEFAULT_WATER_GOAL_ML = 2000

export const WATER_QUICK_ADDS_ML = [250, 500, 750] as const

export function formatWater(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    const text = Number.isInteger(liters) ? String(liters) : liters.toFixed(1)
    return `${text} L`
  }
  return `${Math.round(ml)} ml`
}

export function waterProgress(totalMl: number, goalMl: number): number {
  if (goalMl <= 0) return 0
  return Math.min(1, totalMl / goalMl)
}
