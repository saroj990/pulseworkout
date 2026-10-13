import { db, type Workout, type WorkoutExercise } from '../db'

export function isCompletedWorkout(w: { isPlanned?: boolean }): boolean {
  return !w.isPlanned
}

export function findPlannedWorkoutForDate(
  workouts: Workout[],
  date: string,
): Workout | undefined {
  return workouts.find((w) => w.date === date && w.isPlanned === true)
}

export async function savePlannedWorkout(input: {
  userId: number
  date: string
  title: string
  notes: string
  durationMin: number
  exercises: WorkoutExercise[]
  existingPlannedId?: number
}): Promise<number> {
  const nowIso = new Date().toISOString()
  const payload = {
    userId: input.userId,
    date: input.date,
    title: input.title,
    notes: input.notes,
    durationMin: input.durationMin,
    exercises: input.exercises,
    isPlanned: true as const,
    updatedAt: nowIso,
  }

  if (input.existingPlannedId != null) {
    await db.workouts.update(input.existingPlannedId, payload)
    return input.existingPlannedId
  }

  const logged = await db.workouts
    .where('userId')
    .equals(input.userId)
    .filter((w) => w.date === input.date && !w.isPlanned)
    .first()
  if (logged) {
    throw new Error('You already logged a workout for this day.')
  }

  const otherPlan = await db.workouts
    .where('userId')
    .equals(input.userId)
    .filter((w) => w.date === input.date && w.isPlanned === true)
    .first()
  if (otherPlan?.id != null) {
    await db.workouts.update(otherPlan.id, payload)
    return otherPlan.id
  }

  return Number(await db.workouts.add({ ...payload, createdAt: nowIso }))
}
