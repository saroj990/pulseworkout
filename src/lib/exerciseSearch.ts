import type { Exercise, MuscleGroup } from '../db'
import { MUSCLE_LABELS } from '../data/exercises'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokensFromQuery(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean)
}

export function exerciseSearchText(ex: Exercise): string {
  return normalize(
    [
      ex.name,
      ex.equipment,
      MUSCLE_LABELS[ex.muscle],
      ex.muscle,
      ex.description,
      ex.imageKey.replace(/-/g, ' '),
    ].join(' '),
  )
}

/** Every query word must appear somewhere in the exercise text (frontend full-text). */
export function scoreExerciseMatch(ex: Exercise, query: string): number | null {
  const tokens = tokensFromQuery(query)
  if (tokens.length === 0) return 0

  const hay = exerciseSearchText(ex)
  const name = normalize(ex.name)
  if (!tokens.every((t) => hay.includes(t))) return null

  let score = 10
  for (const t of tokens) {
    if (name.startsWith(t)) score += 40
    else if (name.includes(t)) score += 25
    else if (normalize(ex.equipment).includes(t)) score += 12
    else if (normalize(MUSCLE_LABELS[ex.muscle]).includes(t)) score += 10
    else score += 4
  }
  return score
}

/** One row per exercise name (IndexedDB can contain legacy duplicates). */
export function dedupeExercisesByName(list: Exercise[]): Exercise[] {
  const byName = new Map<string, Exercise>()
  for (const ex of list) {
    const key = ex.name.trim().toLowerCase()
    const prev = byName.get(key)
    if (!prev) {
      byName.set(key, ex)
      continue
    }
    const prevId = prev.id ?? Number.MAX_SAFE_INTEGER
    const nextId = ex.id ?? Number.MAX_SAFE_INTEGER
    if (nextId < prevId) byName.set(key, ex)
  }
  return [...byName.values()]
}

export function filterExercisesForBrowse(
  list: Exercise[],
  query: string,
  muscleFilter: MuscleGroup | 'all',
  recentExerciseIds: number[],
  options?: { idleLimit?: number; searchLimit?: number },
): Exercise[] {
  const idleLimit = options?.idleLimit ?? 8
  const searchLimit = options?.searchLimit ?? 40
  const q = query.trim()
  const recentRank = new Map(recentExerciseIds.map((id, i) => [id, i]))

  const unique = dedupeExercisesByName(list)
  const byMuscle =
    muscleFilter === 'all' ? unique : unique.filter((ex) => ex.muscle === muscleFilter)

  if (!q) {
    return [...byMuscle]
      .sort((a, b) => {
        const ar = a.id != null && recentRank.has(a.id) ? recentRank.get(a.id)! : 9999
        const br = b.id != null && recentRank.has(b.id) ? recentRank.get(b.id)! : 9999
        if (ar !== br) return ar - br
        return a.name.localeCompare(b.name)
      })
      .slice(0, idleLimit)
  }

  const scored: { ex: Exercise; score: number; recent: number }[] = []
  for (const ex of byMuscle) {
    const score = scoreExerciseMatch(ex, q)
    if (score == null) continue
    const recent =
      ex.id != null && recentRank.has(ex.id) ? recentRank.get(ex.id)! : 9999
    scored.push({ ex, score, recent })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.recent !== b.recent) return a.recent - b.recent
    return a.ex.name.localeCompare(b.ex.name)
  })

  return scored.slice(0, searchLimit).map((s) => s.ex)
}
