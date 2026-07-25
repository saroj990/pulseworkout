interface Props {
  value: number
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
}

export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  label,
  sublabel,
}: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, value))
  const offset = c * (1 - clamped)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label && <span className="font-display text-2xl font-extrabold leading-none">{label}</span>}
        {sublabel && <span className="mt-1 text-xs font-semibold text-[var(--ink-muted)]">{sublabel}</span>}
      </div>
    </div>
  )
}
