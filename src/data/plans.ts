import type { Exercise, MuscleGroup } from '../db'

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
export const PART_WORKOUTS: Record<MuscleGroup, { title: string; exerciseNames: string[] }> = {
  chest: {
    title: 'Chest Day',
    exerciseNames: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Push-Up', 'Dumbbell Fly', 'Cable Crossover'],
  },
  back: {
    title: 'Back Day',
    exerciseNames: ['Pull-Up', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'Face Pull'],
  },
  shoulders: {
    title: 'Shoulder Day',
    exerciseNames: ['Overhead Press', 'Arnold Press', 'Lateral Raise', 'Rear Delt Fly', 'Face Pull'],
  },
  arms: {
    title: 'Arms Day',
    exerciseNames: ['Barbell Curl', 'Hammer Curl', 'Tricep Pushdown', 'Skull Crusher', 'Cable Curl'],
  },
  legs: {
    title: 'Leg Day',
    exerciseNames: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Walking Lunge', 'Leg Curl'],
  },
  core: {
    title: 'Core Day',
    exerciseNames: ['Plank', 'Hanging Knee Raise', 'Russian Twist', 'Cable Crunch', 'Dead Bug'],
  },
  cardio: {
    title: 'Cardio Day',
    exerciseNames: ['Treadmill Run', 'Jump Rope', 'Rowing Machine', 'Burpee'],
  },
  full: {
    title: 'Full Body',
    exerciseNames: [
      'Back Squat',
      'Barbell Bench Press',
      'Barbell Row',
      'Overhead Press',
      'Plank',
      'Kettlebell Swing',
    ],
  },
}

const UPPER_EXERCISES = [
  'Barbell Bench Press',
  'Barbell Row',
  'Overhead Press',
  'Pull-Up',
  'Lateral Raise',
  'Barbell Curl',
  'Tricep Pushdown',
]

const LOWER_EXERCISES = [
  'Back Squat',
  'Romanian Deadlift',
  'Leg Press',
  'Walking Lunge',
  'Leg Curl',
  'Plank',
]

const PUSH_EXERCISES = [
  'Barbell Bench Press',
  'Incline Dumbbell Press',
  'Overhead Press',
  'Lateral Raise',
  'Tricep Pushdown',
  'Push-Up',
]

const PULL_EXERCISES = [
  'Pull-Up',
  'Barbell Row',
  'Lat Pulldown',
  'Seated Cable Row',
  'Face Pull',
  'Barbell Curl',
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
        'Back Squat',
        'Push-Up',
        'Seated Cable Row',
        'Overhead Press',
        'Walking Lunge',
        'Russian Twist',
      ]),
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

/** Extra exercises beyond the original seed — used for richer part workouts */
export const EXTRA_EXERCISES: Omit<Exercise, 'id'>[] = [
  {
    name: 'Incline Dumbbell Press',
    muscle: 'chest',
    equipment: 'Dumbbells',
    description: 'Press on an incline bench for upper chest emphasis.',
    imageKey: 'incline-press',
    isCustom: false,
  },
  {
    name: 'Cable Crossover',
    muscle: 'chest',
    equipment: 'Cable',
    description: 'Sweep cables together in front of your chest.',
    imageKey: 'cable-crossover',
    isCustom: false,
  },
  {
    name: 'Seated Cable Row',
    muscle: 'back',
    equipment: 'Cable',
    description: 'Pull the handle to your torso, squeeze shoulder blades.',
    imageKey: 'seated-row',
    isCustom: false,
  },
  {
    name: 'Face Pull',
    muscle: 'back',
    equipment: 'Cable',
    description: 'Pull toward your face with elbows high — great for rear delts.',
    imageKey: 'face-pull',
    isCustom: false,
  },
  {
    name: 'Arnold Press',
    muscle: 'shoulders',
    equipment: 'Dumbbells',
    description: 'Rotate palms as you press overhead.',
    imageKey: 'arnold-press',
    isCustom: false,
  },
  {
    name: 'Rear Delt Fly',
    muscle: 'shoulders',
    equipment: 'Dumbbells',
    description: 'Hinge forward and raise arms out to the sides.',
    imageKey: 'rear-delt',
    isCustom: false,
  },
  {
    name: 'Hammer Curl',
    muscle: 'arms',
    equipment: 'Dumbbells',
    description: 'Curl with a neutral grip for brachialis and forearms.',
    imageKey: 'hammer-curl',
    isCustom: false,
  },
  {
    name: 'Skull Crusher',
    muscle: 'arms',
    equipment: 'Barbell',
    description: 'Lower the bar toward your forehead, then extend.',
    imageKey: 'skull-crusher',
    isCustom: false,
  },
  {
    name: 'Cable Curl',
    muscle: 'arms',
    equipment: 'Cable',
    description: 'Curl with constant cable tension.',
    imageKey: 'cable-curl',
    isCustom: false,
  },
  {
    name: 'Leg Curl',
    muscle: 'legs',
    equipment: 'Machine',
    description: 'Curl heels toward glutes, control the eccentric.',
    imageKey: 'leg-curl',
    isCustom: false,
  },
  {
    name: 'Cable Crunch',
    muscle: 'core',
    equipment: 'Cable',
    description: 'Kneel and crunch the cable down with abs, not arms.',
    imageKey: 'cable-crunch',
    isCustom: false,
  },
  {
    name: 'Dead Bug',
    muscle: 'core',
    equipment: 'Bodyweight',
    description: 'Extend opposite arm and leg while keeping low back flat.',
    imageKey: 'dead-bug',
    isCustom: false,
  },
  {
    name: 'Rowing Machine',
    muscle: 'cardio',
    equipment: 'Machine',
    description: 'Drive with legs, then lean and pull. Smooth strokes.',
    imageKey: 'rower',
    isCustom: false,
  },
]
