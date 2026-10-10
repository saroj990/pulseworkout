import { resolveExerciseName } from './exerciseLibrary'

/** Reasonable default sets for known exercises. Weights are in kg. */
export type ExerciseDefault = {
  reps: number
  weightKg: number
  sets: number
}

const FALLBACK_BY_MUSCLE: Record<string, ExerciseDefault> = {
  chest: { reps: 10, weightKg: 40, sets: 3 },
  back: { reps: 10, weightKg: 40, sets: 3 },
  shoulders: { reps: 12, weightKg: 12, sets: 3 },
  arms: { reps: 12, weightKg: 14, sets: 3 },
  legs: { reps: 10, weightKg: 60, sets: 3 },
  core: { reps: 15, weightKg: 0, sets: 3 },
  cardio: { reps: 1, weightKg: 0, sets: 1 },
  full: { reps: 10, weightKg: 20, sets: 3 },
}

/** Per-exercise overrides (kg). */
export const EXERCISE_DEFAULTS: Record<string, ExerciseDefault> = {
  'Barbell Bench Press': { reps: 8, weightKg: 60, sets: 3 },
  'Incline Dumbbell Press': { reps: 10, weightKg: 22, sets: 3 },
  'Push-Up': { reps: 12, weightKg: 0, sets: 3 },
  'Dumbbell Fly': { reps: 12, weightKg: 12, sets: 3 },
  'Cable Crossover': { reps: 12, weightKg: 10, sets: 3 },
  'Pull-Up': { reps: 8, weightKg: 0, sets: 3 },
  'Barbell Row': { reps: 8, weightKg: 50, sets: 3 },
  'Lat Pulldown': { reps: 10, weightKg: 45, sets: 3 },
  'Seated Cable Row': { reps: 10, weightKg: 40, sets: 3 },
  'Face Pull': { reps: 15, weightKg: 15, sets: 3 },
  'Overhead Press': { reps: 8, weightKg: 35, sets: 3 },
  'Arnold Press': { reps: 10, weightKg: 14, sets: 3 },
  'Lateral Raise': { reps: 12, weightKg: 8, sets: 3 },
  'Rear Delt Fly': { reps: 12, weightKg: 8, sets: 3 },
  'Barbell Curl': { reps: 10, weightKg: 25, sets: 3 },
  'Hammer Curl': { reps: 10, weightKg: 12, sets: 3 },
  'Cable Curl': { reps: 12, weightKg: 15, sets: 3 },
  'Tricep Pushdown': { reps: 12, weightKg: 20, sets: 3 },
  'Skull Crusher': { reps: 10, weightKg: 20, sets: 3 },
  'Back Squat': { reps: 8, weightKg: 70, sets: 3 },
  'Romanian Deadlift': { reps: 8, weightKg: 60, sets: 3 },
  'Leg Press': { reps: 12, weightKg: 100, sets: 3 },
  'Walking Lunge': { reps: 10, weightKg: 14, sets: 3 },
  'Leg Curl': { reps: 12, weightKg: 35, sets: 3 },
  Plank: { reps: 45, weightKg: 0, sets: 3 },
  'Hanging Knee Raise': { reps: 12, weightKg: 0, sets: 3 },
  'Russian Twist': { reps: 20, weightKg: 0, sets: 3 },
  'Cable Crunch': { reps: 15, weightKg: 25, sets: 3 },
  'Dead Bug': { reps: 12, weightKg: 0, sets: 3 },
  'Treadmill Run': { reps: 20, weightKg: 0, sets: 1 },
  'Jump Rope': { reps: 100, weightKg: 0, sets: 3 },
  'Rowing Machine': { reps: 15, weightKg: 0, sets: 1 },
  Burpee: { reps: 10, weightKg: 0, sets: 3 },
  'High Knee Jump': { reps: 20, weightKg: 0, sets: 3 },
  'High Knees': { reps: 30, weightKg: 0, sets: 3 },
  'Jumping Jacks': { reps: 40, weightKg: 0, sets: 3 },
  'Star Jumps': { reps: 15, weightKg: 0, sets: 3 },
  'Tuck Jumps': { reps: 12, weightKg: 0, sets: 3 },
  'Squat Jumps': { reps: 15, weightKg: 0, sets: 3 },
  'Split Jumps': { reps: 12, weightKg: 0, sets: 3 },
  'Lateral Jumps': { reps: 20, weightKg: 0, sets: 3 },
  'Broad Jumps': { reps: 8, weightKg: 0, sets: 3 },
  'Skater Jumps': { reps: 20, weightKg: 0, sets: 3 },
  'Frog Jumps': { reps: 12, weightKg: 0, sets: 3 },
  'Seal Jacks': { reps: 40, weightKg: 0, sets: 3 },
  'Knee Raise Twist': { reps: 20, weightKg: 0, sets: 3 },
  'Standing Knee-to-Elbow': { reps: 20, weightKg: 0, sets: 3 },
  'High Knee Twist': { reps: 30, weightKg: 0, sets: 3 },
  'Cross-Body Mountain Climbers': { reps: 30, weightKg: 0, sets: 3 },
  'Mountain Climbers': { reps: 30, weightKg: 0, sets: 3 },
  'Plank Jacks': { reps: 25, weightKg: 0, sets: 3 },
  'Plank Knee Drives': { reps: 20, weightKg: 0, sets: 3 },
  'Bear Crawl': { reps: 30, weightKg: 0, sets: 3 },
  'Crab Toe Touch': { reps: 16, weightKg: 0, sets: 3 },
  'Standing Oblique Crunch': { reps: 20, weightKg: 0, sets: 3 },
  'Bicycle Crunches': { reps: 20, weightKg: 0, sets: 3 },
  'Cross-Body Knee Drives': { reps: 20, weightKg: 0, sets: 3 },
  'Cross Jacks': { reps: 40, weightKg: 0, sets: 3 },
  'Power Jacks': { reps: 25, weightKg: 0, sets: 3 },
  'Kettlebell Swing': { reps: 15, weightKg: 16, sets: 3 },
}

export function getExerciseDefault(
  name: string,
  muscle: string,
  units: 'kg' | 'lbs' = 'kg',
): ExerciseDefault {
  const canonical = resolveExerciseName(name)
  const base = EXERCISE_DEFAULTS[canonical] ?? EXERCISE_DEFAULTS[name] ?? FALLBACK_BY_MUSCLE[muscle] ?? {
    reps: 10,
    weightKg: 20,
    sets: 3,
  }
  const weight =
    units === 'lbs' ? Math.round(base.weightKg * 2.20462) : base.weightKg
  return { reps: base.reps, weightKg: weight, sets: base.sets }
}
