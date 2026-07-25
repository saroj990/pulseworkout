import type { MuscleGroup } from '../db'
import { MUSCLE_COLORS } from '../data/exercises'

const ICONS: Record<string, string> = {
  'bench-press': 'M12 8v8M8 12h8M6 6l4 4M18 6l-4 4M6 18l4-4M18 18l-4-4',
  'push-up': 'M4 14h16M8 14v4M16 14v4M12 6v4',
  fly: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M5 8l4 3M19 8l-4 3M5 16l4-3M19 16l-4-3',
  'pull-up': 'M4 6h16M8 6v8a4 4 0 0 0 8 0V6',
  row: 'M4 12h12M16 8v8M7 9l-3 3 3 3',
  pulldown: 'M8 4h8M12 4v10M8 14l4 4 4-4',
  ohp: 'M12 20V8M8 12l4-4 4 4M8 4h8',
  lateral: 'M4 12h16M6 12l2-6M18 12l-2-6',
  curl: 'M8 18c0-6 2-10 4-10s4 4 4 10M8 18h8',
  pushdown: 'M12 4v12M8 12l4 4 4-4',
  squat: 'M8 6v6l4 6 4-6V6M8 12h8',
  rdl: 'M12 4v10M8 14l4 6 4-6M9 8h6',
  lunge: 'M8 4v16M16 8v12M8 12h5',
  'leg-press': 'M4 16h16M6 16V8h4v8M14 16V10h4v6',
  plank: 'M4 12h16M6 12v4M18 12v4M10 8h4',
  'knee-raise': 'M12 4v8M8 12c0 4 2 6 4 6s4-2 4-6',
  twist: 'M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M9 12h6M12 9v6',
  run: 'M13 5l2 3-3 2 2 4M8 19l3-5',
  'jump-rope': 'M8 6c-2 4-2 8 0 12M16 6c2 4 2 8 0 12M8 12h8',
  burpee: 'M12 4v4M8 10h8M10 14l2 6 2-6',
  swing: 'M12 20V10M8 12c2-4 4-6 4-6s2 2 4 6',
}

interface Props {
  imageKey: string
  muscle: MuscleGroup
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-28 w-28',
}

export function ExerciseImage({ imageKey, muscle, size = 'md', className = '' }: Props) {
  const color = MUSCLE_COLORS[muscle]
  const paths = ICONS[imageKey] ?? ICONS.squat

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl ${SIZES[size]} ${className}`}
      style={{
        background: `linear-gradient(145deg, ${color}22 0%, ${color}55 100%)`,
      }}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 30% 30%, white, transparent 55%)`,
        }}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute inset-[18%] h-[64%] w-[64%]"
      >
        <path d={paths} />
      </svg>
    </div>
  )
}
