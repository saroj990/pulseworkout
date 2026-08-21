import { useEffect, useRef, useState } from 'react'
import type { MuscleGroup } from '../db'
import { MUSCLE_COLORS } from '../data/exercises'

/**
 * Drop files at `src/assets/exercises/{imageKey}.svg` and/or
 * `{imageKey}.webm` / `{imageKey}.mp4`. Videos play when the tile is on screen;
 * SVG (or stroke fallback) is used otherwise. Bundled media is precached by the PWA.
 */
const svgModules = import.meta.glob('../assets/exercises/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const videoModules = import.meta.glob('../assets/exercises/*.{webm,mp4}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function assetUrlFor(
  modules: Record<string, string>,
  imageKey: string,
  exts: string[],
): string | undefined {
  const match = Object.entries(modules).find(([path]) =>
    exts.some((ext) => path.endsWith(`/${imageKey}.${ext}`)),
  )
  return match?.[1]
}

function svgUrlFor(imageKey: string): string | undefined {
  return assetUrlFor(svgModules, imageKey, ['svg'])
}

function videoUrlFor(imageKey: string): string | undefined {
  // Prefer WebM (smaller) then MP4
  return (
    assetUrlFor(videoModules, imageKey, ['webm']) ??
    assetUrlFor(videoModules, imageKey, ['mp4'])
  )
}

/** Fallback line icons (24×24 viewBox path data) when no SVG file is present. */
const FALLBACK_PATHS: Record<string, string> = {
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
  'incline-press': 'M12 8v8M8 12h8M6 6l4 4M18 6l-4 4M6 18l4-4M18 18l-4-4',
  'cable-crossover': 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M5 8l4 3M19 8l-4 3M5 16l4-3M19 16l-4-3',
  'seated-row': 'M4 12h12M16 8v8M7 9l-3 3 3 3',
  'face-pull': 'M8 4h8M12 4v10M8 14l4 4 4-4',
  'arnold-press': 'M12 20V8M8 12l4-4 4 4M8 4h8',
  'rear-delt': 'M4 12h16M6 12l2-6M18 12l-2-6',
  'hammer-curl': 'M8 18c0-6 2-10 4-10s4 4 4 10M8 18h8',
  'skull-crusher': 'M12 4v12M8 12l4 4 4-4',
  'cable-curl': 'M8 18c0-6 2-10 4-10s4 4 4 10M8 18h8',
  'leg-curl': 'M4 16h16M6 16V8h4v8M14 16V10h4v6',
  'cable-crunch': 'M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M9 12h6M12 9v6',
  'dead-bug': 'M4 12h16M6 12v4M18 12v4M10 8h4',
  rower: 'M4 12h12M16 8v8M7 9l-3 3 3 3',
}

interface Props {
  imageKey: string
  muscle: MuscleGroup
  size?: 'sm' | 'md' | 'lg' | 'hero'
  className?: string
  /** Prefer looping demo video when a file exists (default: true for md/lg/hero, false for sm). */
  preferVideo?: boolean
}

/** Mobile-first: video tiles run larger on phones, tighten a bit from `sm` up. */
const SIZES = {
  sm: 'h-12 w-12',
  md: 'h-[4.75rem] w-[4.75rem] sm:h-16 sm:w-16',
  lg: 'h-28 w-28 sm:h-24 sm:w-24',
  hero: 'aspect-[4/3] w-full max-h-56 sm:aspect-square sm:h-28 sm:w-28 sm:max-h-none',
}

function StaticIcon({
  imageKey,
  color,
  svgUrl,
}: {
  imageKey: string
  color: string
  svgUrl?: string
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const path = FALLBACK_PATHS[imageKey] ?? FALLBACK_PATHS.squat
  const useFile = Boolean(svgUrl) && !imgFailed

  if (useFile) {
    return (
      <img
        src={svgUrl}
        alt=""
        className="absolute inset-[14%] h-[72%] w-[72%] object-contain"
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute inset-[18%] h-[64%] w-[64%]"
    >
      <path d={path} />
    </svg>
  )
}

export function ExerciseImage({
  imageKey,
  muscle,
  size = 'md',
  className = '',
  preferVideo,
}: Props) {
  const color = MUSCLE_COLORS[muscle]
  const svgUrl = svgUrlFor(imageKey)
  const bundledVideoUrl = videoUrlFor(imageKey)
  const wantVideo = preferVideo ?? size !== 'sm'
  const videoEnabled = wantVideo && Boolean(bundledVideoUrl)
  const isHero = size === 'hero'

  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [inView, setInView] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)

  useEffect(() => {
    if (!videoEnabled) return
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '80px', threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [videoEnabled])

  // Fetch full file → blob URL so offline playback works without HTTP Range requests
  useEffect(() => {
    if (!videoEnabled || !bundledVideoUrl || !inView || videoFailed) return
    let cancelled = false
    let objectUrl: string | undefined

    fetch(bundledVideoUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`video ${r.status}`)
        return r.blob()
      })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setVideoFailed(true)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [videoEnabled, bundledVideoUrl, inView, videoFailed])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !blobUrl) return
    if (inView) {
      void v.play().catch(() => setVideoFailed(true))
    } else {
      v.pause()
    }
  }, [inView, blobUrl])

  const showVideo = videoEnabled && Boolean(blobUrl) && !videoFailed

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 overflow-hidden rounded-2xl ${SIZES[size]} ${className} ${
        showVideo || isHero ? 'ring-1 ring-black/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]' : ''
      }`}
      style={{
        background: `linear-gradient(145deg, ${color}22 0%, ${color}55 100%)`,
      }}
      aria-hidden
    >
      {!showVideo && (
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 30%, white, transparent 55%)`,
          }}
        />
      )}
      {showVideo ? (
        <video
          ref={videoRef}
          src={blobUrl ?? undefined}
          className={`absolute inset-0 h-full w-full ${
            isHero ? 'object-contain bg-black/[0.04] p-1 sm:p-0 sm:object-cover' : 'object-cover'
          }`}
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <StaticIcon imageKey={imageKey} color={color} svgUrl={svgUrl} />
      )}
    </div>
  )
}
