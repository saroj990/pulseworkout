import { exerciseNamesForMuscle } from './exerciseLibrary'

/** Cardio preset names (reference list + plan extras). */
export const CARDIO_EXERCISE_NAMES: string[] = exerciseNamesForMuscle('cardio')

export const CARDIO_PLAN_DAY_A = CARDIO_EXERCISE_NAMES.slice(0, 9)
export const CARDIO_PLAN_DAY_B = CARDIO_EXERCISE_NAMES.slice(9, 18)
export const CARDIO_PLAN_DAY_C = CARDIO_EXERCISE_NAMES.slice(18)
