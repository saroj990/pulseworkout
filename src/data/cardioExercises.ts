import type { Exercise } from '../db'

/** Names used in cardio presets and the Cardio Conditioning plan */
export const CARDIO_EXERCISE_NAMES: string[] = [
  'High Knee Jump',
  'High Knees',
  'Jumping Jacks',
  'Star Jumps',
  'Tuck Jumps',
  'Squat Jumps',
  'Split Jumps',
  'Lateral Jumps',
  'Broad Jumps',
  'Skater Jumps',
  'Frog Jumps',
  'Seal Jacks',
  'Knee Raise Twist',
  'Standing Knee-to-Elbow',
  'High Knee Twist',
  'Cross-Body Mountain Climbers',
  'Mountain Climbers',
  'Plank Jacks',
  'Plank Knee Drives',
  'Bear Crawl',
  'Crab Toe Touch',
  'Standing Oblique Crunch',
  'Bicycle Crunches',
  'Russian Twist',
  'Cross-Body Knee Drives',
  'Cross Jacks',
  'Power Jacks',
  'Jump Rope',
]

function cardio(
  name: string,
  imageKey: string,
  description: string,
): Omit<Exercise, 'id'> {
  return {
    name,
    muscle: 'cardio',
    equipment: 'Bodyweight',
    description,
    imageKey,
    isCustom: false,
  }
}

/** New cardio moves (library entries). Russian Twist & Jump Rope already exist in seed. */
export const CARDIO_SEED_EXERCISES: Omit<Exercise, 'id'>[] = [
  cardio('High Knee Jump', 'knee-raise', 'Drive knees up explosively with a small hop each rep.'),
  cardio('High Knees', 'knee-raise', 'Run in place, lifting knees to hip height. Stay on the balls of your feet.'),
  cardio('Jumping Jacks', 'jump-rope', 'Jump feet wide while arms overhead, then return. Keep rhythm steady.'),
  cardio('Star Jumps', 'jump-rope', 'Jump and spread arms and legs into a star, land soft, repeat.'),
  cardio('Tuck Jumps', 'squat', 'Jump and pull knees toward chest. Land with bent knees.'),
  cardio('Squat Jumps', 'squat', 'Squat down, then explode up. Reset each rep or link for power.'),
  cardio('Split Jumps', 'lunge', 'Alternate jump lunges, switching legs in the air.'),
  cardio('Lateral Jumps', 'lunge', 'Jump side to side over an imaginary line. Stay low and balanced.'),
  cardio('Broad Jumps', 'lunge', 'Swing arms and jump forward as far as you can. Walk back and repeat.'),
  cardio('Skater Jumps', 'lunge', 'Leap side to side, landing on one foot like a speed skater.'),
  cardio('Frog Jumps', 'squat', 'Deep squat, hands on floor, hop forward. Great for legs and heart rate.'),
  cardio('Seal Jacks', 'jump-rope', 'Jump while clapping hands in front and behind like a seal.'),
  cardio('Knee Raise Twist', 'twist', 'Raise knee across body toward opposite elbow. Alternate sides.'),
  cardio('Standing Knee-to-Elbow', 'knee-raise', 'Crunch obliques by bringing knee to opposite elbow standing.'),
  cardio('High Knee Twist', 'knee-raise', 'High knees with a slight torso twist each step.'),
  cardio(
    'Cross-Body Mountain Climbers',
    'burpee',
    'In plank, drive knees toward opposite elbow. Keep hips level.',
  ),
  cardio('Mountain Climbers', 'burpee', 'Fast alternating knee drives in plank. Core tight, shoulders over wrists.'),
  cardio('Plank Jacks', 'plank', 'Hold plank while jumping feet out and in. Don’t let hips sag.'),
  cardio('Plank Knee Drives', 'plank', 'From plank, drive one knee toward chest, then switch quickly.'),
  cardio('Bear Crawl', 'plank', 'Crawl on hands and feet, knees hovering. Move forward or in place.'),
  cardio('Crab Toe Touch', 'plank', 'In crab walk, reach opposite hand to toe. Hips up.'),
  cardio('Standing Oblique Crunch', 'twist', 'Elbow to knee on the same side. Squeeze obliques.'),
  cardio('Bicycle Crunches', 'twist', 'Lie on back, pedal legs while twisting elbow to knee.'),
  cardio('Cross-Body Knee Drives', 'knee-raise', 'Standing or marching — knee up and across to opposite hand.'),
  cardio('Cross Jacks', 'jump-rope', 'Jumping jack with arms crossing in front on one jump.'),
  cardio('Power Jacks', 'jump-rope', 'Explosive jumping jacks — higher jump, soft landing.'),
]

export const CARDIO_PLAN_DAY_A = CARDIO_EXERCISE_NAMES.slice(0, 9)
export const CARDIO_PLAN_DAY_B = CARDIO_EXERCISE_NAMES.slice(9, 18)
export const CARDIO_PLAN_DAY_C = CARDIO_EXERCISE_NAMES.slice(18)
