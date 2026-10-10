import type { MuscleGroup } from '../db'
import { BUILTIN_EXERCISES } from './exerciseLibrary'

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
  full: 'Full Body',
}

export const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  chest: '#e11d48',
  back: '#2563eb',
  shoulders: '#d97706',
  arms: '#7c3aed',
  legs: '#059669',
  core: '#0891b2',
  cardio: '#dc2626',
  full: '#0f766e',
}

/** Built-in exercise library seeded into IndexedDB. */
export const SEED_EXERCISES = BUILTIN_EXERCISES
