import type { MuscleGroup } from '../db'
import {
  CARDIO_EXERCISE_NAMES,
  CARDIO_PLAN_DAY_A,
  CARDIO_PLAN_DAY_B,
  CARDIO_PLAN_DAY_C,
} from './cardioExercises'
import { exerciseNamesForMuscle } from './exerciseLibrary'

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // Sun–Sat

export interface PlanDay {
  weekday: Weekday
  /** Empty = rest day */
  muscles: MuscleGroup[]
  title: string
  /** Exercise names resolved from the library when starting */
  exerciseNames: string[]
}

export interface PlanTemplate {
  id: string
  name: string
  description: string
  tag: string
  days: PlanDay[]
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WEEKDAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/** Default workout for each body part */
function partDay(muscle: MuscleGroup, title: string, count = 6): { title: string; exerciseNames: string[] } {
  return { title, exerciseNames: exerciseNamesForMuscle(muscle).slice(0, count) }
}

export const PART_WORKOUTS: Record<MuscleGroup, { title: string; exerciseNames: string[] }> = {
  chest: partDay('chest', 'Chest Day'),
  back: partDay('back', 'Back Day'),
  shoulders: partDay('shoulders', 'Shoulder Day'),
  arms: partDay('arms', 'Arms Day'),
  legs: partDay('legs', 'Leg Day'),
  core: partDay('core', 'Core Day'),
  cardio: {
    title: 'Cardio Day',
    exerciseNames: [...CARDIO_EXERCISE_NAMES],
  },
  full: {
    title: 'Full Body',
    exerciseNames: [
      'Barbell Back Squat',
      'Barbell Bench Press',
      'Bent-Over Barbell Row',
      'Barbell Overhead Press',
      'Plank',
      'Kettlebell Swing',
    ],
  },
}

const UPPER_EXERCISES = [
  'Barbell Bench Press',
  'Bent-Over Barbell Row',
  'Barbell Overhead Press',
  'Pull-Ups',
  'Dumbbell Lateral Raise',
  'Barbell Biceps Curl',
  'Triceps Pushdown',
]

const LOWER_EXERCISES = [
  'Barbell Back Squat',
  'Romanian Deadlift',
  'Leg Press',
  'Walking Lunges',
  'Lying Leg Curl',
  'Plank',
]

const PUSH_EXERCISES = [
  'Barbell Bench Press',
  'Incline Dumbbell Press',
  'Barbell Overhead Press',
  'Dumbbell Lateral Raise',
  'Triceps Pushdown',
  'Push-Ups',
]

const PULL_EXERCISES = [
  'Pull-Ups',
  'Bent-Over Barbell Row',
  'Lat Pulldown',
  'Seated Cable Row',
  'Face Pull',
  'Barbell Biceps Curl',
]

function day(
  weekday: Weekday,
  muscles: MuscleGroup[],
  title: string,
  exerciseNames: string[],
): PlanDay {
  return { weekday, muscles, title, exerciseNames }
}

function rest(weekday: Weekday): PlanDay {
  return { weekday, muscles: [], title: 'Rest', exerciseNames: [] }
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'bro-split',
    name: 'Bro Split',
    tag: 'Mon–Fri',
    description: 'One body part per weekday. Classic gym split with weekends off.',
    days: [
      rest(0),
      day(1, ['chest'], 'Chest', PART_WORKOUTS.chest.exerciseNames),
      day(2, ['back'], 'Back', PART_WORKOUTS.back.exerciseNames),
      day(3, ['legs'], 'Legs', PART_WORKOUTS.legs.exerciseNames),
      day(4, ['shoulders'], 'Shoulders', PART_WORKOUTS.shoulders.exerciseNames),
      day(5, ['arms'], 'Arms', PART_WORKOUTS.arms.exerciseNames),
      rest(6),
    ],
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    tag: '6 days',
    description: 'Push, pull, then legs — repeated twice. High frequency.',
    days: [
      rest(0),
      day(1, ['chest', 'shoulders', 'arms'], 'Push', PUSH_EXERCISES),
      day(2, ['back', 'arms'], 'Pull', PULL_EXERCISES),
      day(3, ['legs'], 'Legs', PART_WORKOUTS.legs.exerciseNames),
      day(4, ['chest', 'shoulders', 'arms'], 'Push', PUSH_EXERCISES),
      day(5, ['back', 'arms'], 'Pull', PULL_EXERCISES),
      day(6, ['legs'], 'Legs', PART_WORKOUTS.legs.exerciseNames),
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    tag: '4 days',
    description: 'Alternate upper and lower body. Solid for strength and recovery.',
    days: [
      rest(0),
      day(1, ['chest', 'back', 'shoulders', 'arms'], 'Upper', UPPER_EXERCISES),
      day(2, ['legs', 'core'], 'Lower', LOWER_EXERCISES),
      rest(3),
      day(4, ['chest', 'back', 'shoulders', 'arms'], 'Upper', UPPER_EXERCISES),
      day(5, ['legs', 'core'], 'Lower', LOWER_EXERCISES),
      rest(6),
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body 3-Day',
    tag: 'Mon / Wed / Fri',
    description: 'Hit everything three times a week. Great for beginners.',
    days: [
      rest(0),
      day(1, ['full'], 'Full Body A', PART_WORKOUTS.full.exerciseNames),
      rest(2),
      day(3, ['full'], 'Full Body B', [
        'Leg Press',
        'Incline Dumbbell Press',
        'Lat Pulldown',
        'Arnold Press',
        'Romanian Deadlift',
        'Plank',
      ]),
      rest(4),
      day(5, ['full'], 'Full Body C', [
        'Barbell Back Squat',
        'Push-Ups',
        'Seated Cable Row',
        'Barbell Overhead Press',
        'Walking Lunges',
        'Russian Twists',
      ]),
      rest(6),
    ],
  },
  {
    id: 'cardio-conditioning',
    name: 'Cardio Conditioning',
    tag: 'Mon / Wed / Fri',
    description:
      'Bodyweight cardio and core — jumps, jacks, mountain climbers, and more. Three focused sessions per week.',
    days: [
      rest(0),
      day(1, ['cardio'], 'Cardio A · Jumps', CARDIO_PLAN_DAY_A),
      rest(2),
      day(3, ['cardio'], 'Cardio B · Core & climbers', CARDIO_PLAN_DAY_B),
      rest(4),
      day(5, ['cardio'], 'Cardio C · Mix', CARDIO_PLAN_DAY_C),
      rest(6),
    ],
  },
]

export function buildDayFromMuscles(muscles: MuscleGroup[]): PlanDay {
  if (muscles.length === 0) {
    return { weekday: 0, muscles: [], title: 'Rest', exerciseNames: [] }
  }
  if (muscles.length === 1) {
    const part = PART_WORKOUTS[muscles[0]]
    return {
      weekday: 0,
      muscles,
      title: part.title,
      exerciseNames: [...part.exerciseNames],
    }
  }
  const names: string[] = []
  for (const m of muscles) {
    for (const n of PART_WORKOUTS[m].exerciseNames.slice(0, 3)) {
      if (!names.includes(n)) names.push(n)
    }
  }
  const title = muscles.map((m) => m[0].toUpperCase() + m.slice(1)).join(' + ')
  return { weekday: 0, muscles, title, exerciseNames: names.slice(0, 8) }
}

export function emptyCustomWeek(): PlanDay[] {
  return ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => ({
    weekday,
    muscles: [],
    title: 'Rest',
    exerciseNames: [],
  }))
}

export function getPlanDayForDate(days: PlanDay[], date: Date): PlanDay | undefined {
  const weekday = date.getDay() as Weekday
  return days.find((d) => d.weekday === weekday)
}

export function getPlanDayForWeekday(days: PlanDay[], weekday: Weekday): PlanDay {
  return (
    days.find((d) => d.weekday === weekday) ?? {
      weekday,
      muscles: [],
      title: 'Rest',
      exerciseNames: [],
    }
  )
}

export type WorkoutPresetOption = {
  id: string
  label: string
  exerciseNames: string[]
  muscles: MuscleGroup[]
}

/** Workout days from built-in weekly templates (without changing your active plan). */
export function templateWorkoutPresets(): WorkoutPresetOption[] {
  return PLAN_TEMPLATES.flatMap((t) =>
    t.days
      .filter((d) => d.muscles.length > 0 && d.exerciseNames.length > 0)
      .map((d) => ({
        id: `${t.id}-w${d.weekday}`,
        label: `${t.name} · ${d.title}`,
        exerciseNames: [...d.exerciseNames],
        muscles: [...d.muscles],
      })),
  )
}
