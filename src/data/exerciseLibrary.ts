import type { Exercise, MuscleGroup } from '../db'
import { imageKeyForExercise, inferEquipment } from './exerciseImageKeys'
/** Display order — matches common gym split / reference library. */
export const LIBRARY_MUSCLE_ORDER: MuscleGroup[] = [
  'back',
  'chest',
  'arms',
  'legs',
  'shoulders',
  'cardio',
  'core',
  'full',
]

type Entry = { name: string; equipment?: string; description?: string; imageKey?: string }

function build(muscle: MuscleGroup, entries: Entry[]): Omit<Exercise, 'id'>[] {
  return entries.map(({ name, equipment, description, imageKey }) => ({
    name,
    muscle,
    equipment: equipment ?? inferEquipment(name),
    description:
      description ??
      `${name} — common ${muscle} training movement.`,
    imageKey: imageKey ?? imageKeyForExercise(name, muscle),
    isCustom: false,
  }))
}

const BACK = build('back', [
  { name: 'Lat Pulldown' },
  { name: 'Pull-Ups' },
  { name: 'Chin-Ups' },
  { name: 'Bent-Over Barbell Row' },
  { name: 'Seated Cable Row' },
  { name: 'One-Arm Dumbbell Row' },
  { name: 'T-Bar Row' },
  { name: 'Chest-Supported Row' },
  { name: 'Machine Row' },
  { name: 'Straight-Arm Cable Pulldown' },
  { name: 'Deadlift' },
  { name: 'Rack Pull' },
  { name: 'Face Pull' },
  { name: 'Back Extension' },
  { name: 'Inverted Row' },
  { name: 'Dumbbell Pullover' },
  { name: 'Reverse-Grip Barbell Row' },
])

const CHEST = build('chest', [
  { name: 'Barbell Bench Press' },
  { name: 'Incline Barbell Bench Press' },
  { name: 'Decline Barbell Bench Press' },
  { name: 'Dumbbell Bench Press' },
  { name: 'Incline Dumbbell Press' },
  { name: 'Decline Dumbbell Press' },
  { name: 'Push-Ups' },
  { name: 'Wide-Grip Push-Ups' },
  { name: 'Incline Push-Ups' },
  { name: 'Decline Push-Ups' },
  { name: 'Dumbbell Chest Fly' },
  { name: 'Cable Crossover' },
  { name: 'Pec Deck Fly' },
  { name: 'Machine Chest Press' },
  { name: 'Incline Cable Fly' },
  { name: 'Chest-Focused Dips' },
  { name: 'Smith Machine Bench Press' },
  { name: 'Dumbbell Squeeze Press' },
])

const ARMS = build('arms', [
  { name: 'Barbell Biceps Curl' },
  { name: 'Dumbbell Biceps Curl' },
  { name: 'Hammer Curl' },
  { name: 'Preacher Curl' },
  { name: 'Concentration Curl' },
  { name: 'Incline Dumbbell Curl' },
  { name: 'Cable Biceps Curl' },
  { name: 'EZ-Bar Curl' },
  { name: 'Reverse Curl' },
  { name: 'Spider Curl' },
  { name: 'Triceps Pushdown' },
  { name: 'Overhead Triceps Extension' },
  { name: 'Skull Crushers' },
  { name: 'Close-Grip Bench Press' },
  { name: 'Triceps Dips' },
  { name: 'Dumbbell Kickback' },
  { name: 'Diamond Push-Ups' },
  { name: 'Wrist Curl' },
  { name: 'Reverse Wrist Curl' },
  { name: "Farmer's Carry" },
])

const LEGS = build('legs', [
  { name: 'Barbell Back Squat' },
  { name: 'Front Squat' },
  { name: 'Goblet Squat' },
  { name: 'Leg Press' },
  { name: 'Leg Extension' },
  { name: 'Lying Leg Curl' },
  { name: 'Seated Leg Curl' },
  { name: 'Romanian Deadlift', description: 'Hinge with soft knees — hamstrings and glutes.' },
  { name: 'Conventional Deadlift' },
  { name: 'Walking Lunges' },
  { name: 'Reverse Lunges' },
  { name: 'Bulgarian Split Squat' },
  { name: 'Step-Ups' },
  { name: 'Hip Thrust' },
  { name: 'Glute Bridge' },
  { name: 'Standing Calf Raise' },
  { name: 'Seated Calf Raise' },
  { name: 'Sumo Squat' },
  { name: 'Hack Squat' },
  { name: 'Nordic Hamstring Curl' },
])

const SHOULDERS = build('shoulders', [
  { name: 'Barbell Overhead Press' },
  { name: 'Dumbbell Shoulder Press' },
  { name: 'Arnold Press' },
  { name: 'Machine Shoulder Press' },
  { name: 'Dumbbell Lateral Raise' },
  { name: 'Cable Lateral Raise' },
  { name: 'Front Dumbbell Raise' },
  { name: 'Plate Front Raise' },
  { name: 'Rear Delt Fly' },
  { name: 'Reverse Pec Deck Fly' },
  { name: 'Upright Row' },
  { name: 'Barbell Push Press' },
  { name: 'Landmine Press' },
  { name: 'Cuban Rotation' },
  { name: 'Cable Rear Delt Fly' },
  { name: 'Dumbbell Shrugs' },
  { name: 'Barbell Shrugs' },
])

/** Reference cardio list + extra bodyweight finishers used in plans. */
const CARDIO = build('cardio', [
  { name: 'Treadmill Running' },
  { name: 'Outdoor Running' },
  { name: 'Brisk Walking' },
  { name: 'Incline Treadmill Walking' },
  { name: 'Stationary Cycling' },
  { name: 'Outdoor Cycling' },
  { name: 'Elliptical Trainer' },
  { name: 'Rowing Machine' },
  { name: 'Stair Climber' },
  { name: 'Jump Rope' },
  { name: 'Swimming' },
  { name: 'Jumping Jacks' },
  { name: 'High Knees' },
  { name: 'Burpees' },
  { name: 'Mountain Climbers' },
  { name: 'Boxing' },
  { name: 'Battle Ropes' },
  { name: 'Step Aerobics' },
  { name: 'Hiking' },
  { name: 'Dance Cardio' },
  { name: 'High Knee Jump', description: 'Drive knees up explosively with a small hop each rep.' },
  { name: 'Star Jumps', description: 'Jump and spread arms and legs into a star, land soft, repeat.' },
  { name: 'Tuck Jumps', description: 'Jump and pull knees toward chest. Land with bent knees.' },
  { name: 'Squat Jumps', description: 'Squat down, then explode up.' },
  { name: 'Split Jumps', description: 'Alternate jump lunges, switching legs in the air.' },
  { name: 'Lateral Jumps', description: 'Jump side to side over an imaginary line.' },
  { name: 'Broad Jumps', description: 'Swing arms and jump forward as far as you can.' },
  { name: 'Skater Jumps', description: 'Leap side to side, landing on one foot.' },
  { name: 'Frog Jumps', description: 'Deep squat hop forward.' },
  { name: 'Seal Jacks', description: 'Jump while clapping hands in front and behind.' },
  { name: 'Cross-Body Mountain Climbers', description: 'Drive knees toward opposite elbow in plank.' },
  { name: 'Plank Jacks', description: 'Hold plank while jumping feet out and in.' },
  { name: 'Plank Knee Drives', description: 'From plank, drive one knee toward chest, switch quickly.' },
  { name: 'Bear Crawl', description: 'Crawl on hands and feet, knees hovering.' },
  { name: 'Crab Toe Touch', description: 'In crab walk, reach opposite hand to toe.' },
  { name: 'Cross Jacks', description: 'Jumping jack with arms crossing in front.' },
  { name: 'Power Jacks', description: 'Explosive jumping jacks — higher jump, soft landing.' },
])

const CORE = build('core', [
  { name: 'Crunches' },
  { name: 'Sit-Ups' },
  { name: 'Plank' },
  { name: 'Side Plank' },
  { name: 'Bicycle Crunches' },
  { name: 'Hanging Leg Raises' },
  { name: 'Lying Leg Raises' },
  { name: 'Reverse Crunches' },
  { name: 'Russian Twists' },
  { name: 'Ab Wheel Rollout' },
  { name: 'Cable Crunches' },
  { name: 'V-Ups' },
  { name: 'Dead Bug' },
  { name: 'Bird Dog' },
  { name: 'Flutter Kicks' },
  { name: 'Heel Touches' },
  { name: 'Pallof Press' },
  { name: 'Cable Woodchoppers' },
  { name: 'Hollow Body Hold' },
  { name: 'Knee Raise Twist', description: 'Raise knee across body toward opposite elbow.' },
  { name: 'Standing Knee-to-Elbow', description: 'Standing oblique crunch — knee to elbow.' },
  { name: 'High Knee Twist', description: 'High knees with a slight torso twist each step.' },
  { name: 'Standing Oblique Crunch', description: 'Elbow to knee on the same side.' },
  { name: 'Cross-Body Knee Drives', description: 'Knee up and across to opposite hand.' },
])

const FULL = build('full', [{ name: 'Kettlebell Swing' }])

export const EXERCISES_BY_MUSCLE: Record<MuscleGroup, Omit<Exercise, 'id'>[]> = {
  back: BACK,
  chest: CHEST,
  arms: ARMS,
  legs: LEGS,
  shoulders: SHOULDERS,
  cardio: CARDIO,
  core: CORE,
  full: FULL,
}

function dedupeByName(list: Omit<Exercise, 'id'>[]): Omit<Exercise, 'id'>[] {
  const out = new Map<string, Omit<Exercise, 'id'>>()
  for (const ex of list) {
    const key = ex.name.trim().toLowerCase()
    if (!out.has(key)) out.set(key, ex)
  }
  return [...out.values()]
}

/** Canonical built-in library (one row per exercise name). */
export const BUILTIN_EXERCISES: Omit<Exercise, 'id'>[] = dedupeByName(
  LIBRARY_MUSCLE_ORDER.flatMap((m) => EXERCISES_BY_MUSCLE[m]),
)

/** Legacy preset / plan names → canonical library name. */
export const EXERCISE_NAME_ALIASES: Record<string, string> = {
  'Pull-Up': 'Pull-Ups',
  'Push-Up': 'Push-Ups',
  'Barbell Row': 'Bent-Over Barbell Row',
  'Barbell Bench Press': 'Barbell Bench Press',
  'Incline Dumbbell Press': 'Incline Dumbbell Press',
  'Dumbbell Fly': 'Dumbbell Chest Fly',
  'Overhead Press': 'Barbell Overhead Press',
  'Lateral Raise': 'Dumbbell Lateral Raise',
  'Barbell Curl': 'Barbell Biceps Curl',
  'Cable Curl': 'Cable Biceps Curl',
  'Tricep Pushdown': 'Triceps Pushdown',
  'Skull Crusher': 'Skull Crushers',
  'Back Squat': 'Barbell Back Squat',
  'Walking Lunge': 'Walking Lunges',
  'Leg Curl': 'Lying Leg Curl',
  'Hanging Knee Raise': 'Hanging Leg Raises',
  'Russian Twist': 'Russian Twists',
  'Cable Crunch': 'Cable Crunches',
  'Treadmill Run': 'Treadmill Running',
  Burpee: 'Burpees',
  'Rowing Machine': 'Rowing Machine',
}

export function resolveExerciseName(name: string): string {
  return EXERCISE_NAME_ALIASES[name] ?? name
}

export function exerciseNamesForMuscle(muscle: MuscleGroup): string[] {
  return EXERCISES_BY_MUSCLE[muscle].map((e) => e.name)
}
