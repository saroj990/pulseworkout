import { db } from '../db'
import type { MuscleGroup } from '../db'
import type { PlanDay, Weekday } from '../data/plans'

export type PlanDayPayload = {
  title: string
  muscles: MuscleGroup[]
  exerciseNames: string[]
}

function fullWeekDays(patchWeekday: Weekday, patch: PlanDayPayload, existingDays: PlanDay[]): PlanDay[] {
  return ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((wd) => {
    if (wd === patchWeekday) {
      return { weekday: wd, ...patch }
    }
    const existing = existingDays.find((d) => d.weekday === wd)
    return (
      existing ?? {
        weekday: wd,
        muscles: [],
        title: 'Rest',
        exerciseNames: [],
      }
    )
  })
}

/** Write one workout day into the user's active plan (or create a minimal active plan). */
export async function upsertActivePlanDay(
  userId: number,
  weekday: Weekday,
  day: PlanDayPayload,
): Promise<void> {
  const activePlan = await db.userPlans
    .where('userId')
    .equals(userId)
    .filter((p) => p.active)
    .first()

  const patch = {
    title: day.title.trim() || 'Workout',
    muscles: [...day.muscles],
    exerciseNames: [...day.exerciseNames],
  }

  if (activePlan?.id) {
    const days = fullWeekDays(weekday, patch, activePlan.days)
    await db.userPlans.update(activePlan.id, {
      days,
      updatedAt: new Date().toISOString(),
    })
    return
  }

  const days = fullWeekDays(weekday, patch, [])
  await db.userPlans.add({
    userId,
    templateId: 'custom',
    name: 'My plan',
    days,
    active: true,
    updatedAt: new Date().toISOString(),
  })
}
