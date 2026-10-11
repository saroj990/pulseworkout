import { db, type Exercise, type MuscleGroup } from '../db'
import { imageKeyForExercise, inferEquipment } from '../data/exerciseImageKeys'

export type AdminExerciseCategory =
  | 'back'
  | 'chest'
  | 'legs'
  | 'shoulders'
  | 'cardio'
  | 'core'
  | 'arms'
  | 'biceps'
  | 'triceps'

export const ADMIN_EXERCISE_CATEGORIES: { id: AdminExerciseCategory; label: string }[] = [
  { id: 'back', label: 'Back' },
  { id: 'chest', label: 'Chest' },
  { id: 'legs', label: 'Legs' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'core', label: 'Core' },
  { id: 'arms', label: 'Arms' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
]

function categoryMuscle(category: AdminExerciseCategory): MuscleGroup {
  if (category === 'biceps' || category === 'triceps') return 'arms'
  return category
}

function matchesArmSubcategory(exercise: Exercise, category: AdminExerciseCategory): boolean {
  if (category === 'arms') return exercise.muscle === 'arms'
  if (category === 'biceps') {
    return (
      exercise.muscle === 'arms' &&
      /biceps|curl|chin-up|hammer|preacher|concentration/i.test(exercise.name)
    )
  }
  if (category === 'triceps') {
    return (
      exercise.muscle === 'arms' &&
      /triceps|pushdown|skull|overhead extension|dip|kickback|press-down/i.test(exercise.name)
    )
  }
  return exercise.muscle === category
}

export function filterExercisesForAdminCategory(
  all: Exercise[],
  category: AdminExerciseCategory,
): Exercise[] {
  return all
    .filter((ex) => matchesArmSubcategory(ex, category))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function filterVisibleExercises(
  all: Exercise[],
  userId: number | undefined,
  hiddenNames: string[] | undefined,
): Exercise[] {
  const hidden = new Set((hiddenNames ?? []).map((n) => n.trim().toLowerCase()))
  return all.filter((ex) => {
    if (hidden.has(ex.name.trim().toLowerCase())) return false
    if (ex.isCustom && ex.userId != null && ex.userId !== userId) return false
    return true
  })
}

export async function addCustomExercise(
  userId: number,
  name: string,
  category: AdminExerciseCategory,
): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Enter an exercise name.')

  const muscle = categoryMuscle(category)
  const existing = await db.exercises
    .filter(
      (ex) =>
        ex.name.trim().toLowerCase() === trimmed.toLowerCase() &&
        (!ex.isCustom || ex.userId === userId),
    )
    .first()
  if (existing) throw new Error('That exercise name already exists.')

  return Number(
    await db.exercises.add({
      name: trimmed,
      muscle,
      equipment: inferEquipment(trimmed),
      description: `${trimmed} — custom ${muscle} exercise.`,
      imageKey: imageKeyForExercise(trimmed, muscle),
      isCustom: true,
      userId,
    }),
  )
}

export async function deleteCustomExercise(userId: number, exerciseId: number): Promise<void> {
  const ex = await db.exercises.get(exerciseId)
  if (!ex?.isCustom || ex.userId !== userId) {
    throw new Error('Only your custom exercises can be deleted.')
  }
  await db.exercises.delete(exerciseId)
}
