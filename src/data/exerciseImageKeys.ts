import type { MuscleGroup } from '../db'

const BY_NAME: Record<string, string> = {
  'lat pulldown': 'pulldown',
  'pull-ups': 'pull-up',
  'chin-ups': 'pull-up',
  'bent-over barbell row': 'row',
  'seated cable row': 'seated-row',
  'one-arm dumbbell row': 'row',
  't-bar row': 'row',
  'chest-supported row': 'row',
  'machine row': 'row',
  'straight-arm cable pulldown': 'pulldown',
  deadlift: 'rdl',
  'romanian deadlift': 'rdl',
  'rack pull': 'rdl',
  'face pull': 'face-pull',
  'back extension': 'plank',
  'inverted row': 'pull-up',
  'dumbbell pullover': 'fly',
  'reverse-grip barbell row': 'row',
  'barbell bench press': 'bench-press',
  'incline barbell bench press': 'incline-press',
  'decline barbell bench press': 'bench-press',
  'dumbbell bench press': 'bench-press',
  'incline dumbbell press': 'incline-press',
  'decline dumbbell press': 'bench-press',
  'push-ups': 'push-up',
  'wide-grip push-ups': 'push-up',
  'incline push-ups': 'push-up',
  'decline push-ups': 'push-up',
  'dumbbell chest fly': 'fly',
  'cable crossover': 'cable-crossover',
  'pec deck fly': 'fly',
  'machine chest press': 'bench-press',
  'incline cable fly': 'fly',
  'chest-focused dips': 'push-up',
  'smith machine bench press': 'bench-press',
  'dumbbell squeeze press': 'bench-press',
  'barbell biceps curl': 'curl',
  'dumbbell biceps curl': 'curl',
  'hammer curl': 'hammer-curl',
  'preacher curl': 'curl',
  'concentration curl': 'curl',
  'incline dumbbell curl': 'curl',
  'cable biceps curl': 'cable-curl',
  'ez-bar curl': 'curl',
  'reverse curl': 'curl',
  'spider curl': 'curl',
  'triceps pushdown': 'pushdown',
  'overhead triceps extension': 'pushdown',
  'skull crushers': 'skull-crusher',
  'close-grip bench press': 'bench-press',
  'triceps dips': 'pushdown',
  'dumbbell kickback': 'pushdown',
  'diamond push-ups': 'push-up',
  'wrist curl': 'curl',
  'reverse wrist curl': 'curl',
  "farmer's carry": 'curl',
  'barbell back squat': 'squat',
  'front squat': 'squat',
  'goblet squat': 'squat',
  'leg press': 'leg-press',
  'leg extension': 'leg-press',
  'lying leg curl': 'leg-curl',
  'seated leg curl': 'leg-curl',
  'conventional deadlift': 'rdl',
  'walking lunges': 'lunge',
  'reverse lunges': 'lunge',
  'bulgarian split squat': 'lunge',
  'step-ups': 'lunge',
  'hip thrust': 'rdl',
  'glute bridge': 'rdl',
  'standing calf raise': 'squat',
  'seated calf raise': 'squat',
  'sumo squat': 'squat',
  'hack squat': 'squat',
  'nordic hamstring curl': 'leg-curl',
  'barbell overhead press': 'ohp',
  'dumbbell shoulder press': 'ohp',
  'arnold press': 'arnold-press',
  'machine shoulder press': 'ohp',
  'dumbbell lateral raise': 'lateral',
  'cable lateral raise': 'lateral',
  'front dumbbell raise': 'lateral',
  'plate front raise': 'lateral',
  'rear delt fly': 'rear-delt',
  'reverse pec deck fly': 'rear-delt',
  'upright row': 'row',
  'barbell push press': 'ohp',
  'landmine press': 'ohp',
  'cuban rotation': 'lateral',
  'cable rear delt fly': 'rear-delt',
  'dumbbell shrugs': 'row',
  'barbell shrugs': 'row',
  'treadmill running': 'run',
  'outdoor running': 'run',
  'brisk walking': 'run',
  'incline treadmill walking': 'run',
  'stationary cycling': 'run',
  'outdoor cycling': 'run',
  'elliptical trainer': 'run',
  'rowing machine': 'rower',
  'stair climber': 'run',
  'jump rope': 'jump-rope',
  swimming: 'run',
  'jumping jacks': 'jump-rope',
  'high knees': 'knee-raise',
  burpees: 'burpee',
  'mountain climbers': 'burpee',
  boxing: 'burpee',
  'battle ropes': 'burpee',
  'step aerobics': 'jump-rope',
  hiking: 'run',
  'dance cardio': 'jump-rope',
  crunches: 'twist',
  'sit-ups': 'twist',
  plank: 'plank',
  'side plank': 'plank',
  'bicycle crunches': 'twist',
  'hanging leg raises': 'knee-raise',
  'lying leg raises': 'knee-raise',
  'reverse crunches': 'twist',
  'russian twists': 'twist',
  'ab wheel rollout': 'plank',
  'cable crunches': 'cable-crunch',
  'v-ups': 'twist',
  'dead bug': 'dead-bug',
  'bird dog': 'dead-bug',
  'flutter kicks': 'knee-raise',
  'heel touches': 'twist',
  'pallof press': 'cable-crunch',
  'cable woodchoppers': 'twist',
  'hollow body hold': 'plank',
  'kettlebell swing': 'swing',
}

const MUSCLE_FALLBACK: Record<MuscleGroup, string> = {
  back: 'row',
  chest: 'bench-press',
  shoulders: 'ohp',
  arms: 'curl',
  legs: 'squat',
  core: 'plank',
  cardio: 'run',
  full: 'swing',
}

export function imageKeyForExercise(name: string, muscle: MuscleGroup): string {
  const key = name.trim().toLowerCase()
  if (BY_NAME[key]) return BY_NAME[key]
  if (key.includes('curl')) return 'curl'
  if (key.includes('row')) return 'row'
  if (key.includes('press') && key.includes('incline')) return 'incline-press'
  if (key.includes('bench')) return 'bench-press'
  if (key.includes('squat')) return 'squat'
  if (key.includes('lunge')) return 'lunge'
  if (key.includes('plank')) return 'plank'
  if (key.includes('jump')) return 'jump-rope'
  return MUSCLE_FALLBACK[muscle]
}

export function inferEquipment(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('barbell')) return 'Barbell'
  if (n.includes('dumbbell')) return 'Dumbbells'
  if (n.includes('cable')) return 'Cable'
  if (n.includes('machine') || n.includes('smith') || n.includes('pec deck')) return 'Machine'
  if (n.includes('kettlebell')) return 'Kettlebell'
  if (
    n.includes('push-up') ||
    n.includes('push-ups') ||
    n.includes('plank') ||
    n.includes('burpee') ||
    n.includes('jumping') ||
    n.includes('bodyweight') ||
    n.includes('crunch') ||
    n.includes('sit-up')
  ) {
    return 'Bodyweight'
  }
  if (n.includes('treadmill') || n.includes('elliptical') || n.includes('rowing') || n.includes('stair')) {
    return 'Machine'
  }
  if (n.includes('jump rope')) return 'Rope'
  if (n.includes('outdoor') || n.includes('hiking') || n.includes('swimming')) return 'None'
  return 'Mixed'
}
