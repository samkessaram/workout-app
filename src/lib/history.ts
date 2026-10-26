import { db, type Exercise, type SessionSet, type Unit } from './db'
import { convert, roundTo } from './units'

/** One Session's worth of an Exercise, as the chips and the engine see it. */
export interface ExerciseSession {
  sessionId: number
  date: string
  startedAt: number
  location: string
  trainer: boolean
  sets: SessionSet[]
  /** Exercise-level and Set-level chips, merged. */
  chips: string[]
}

export async function exerciseHistory(
  exerciseId: number,
  store = db,
  opts: { excludeSessionId?: number } = {},
): Promise<ExerciseSession[]> {
  const sessions = await store.sessions.toArray()
  return sessions
    .filter((s) => s.id !== opts.excludeSessionId)
    .map((s) => {
      const sets = s.sets.filter((x) => x.exerciseId === exerciseId)
      const chips = [...(s.exerciseChips?.[exerciseId] ?? []), ...sets.flatMap((x) => x.chips ?? [])]
      return {
        sessionId: s.id!,
        date: s.date,
        startedAt: s.startedAt,
        location: s.location,
        trainer: s.trainer,
        sets,
        chips: [...new Set(chips)],
      }
    })
    .filter((h) => h.sets.length > 0)
    .sort((a, b) => a.startedAt - b.startedAt)
}

/** Step in the active unit; converted steps round to a loadable fraction. */
export function stepIn(ex: Pick<Exercise, 'step' | 'stepUnit'>, unit: Unit): number {
  if (ex.stepUnit === unit) return ex.step
  return Math.max(unit === 'kg' ? 0.25 : 0.5, roundTo(convert(ex.step, ex.stepUnit, unit), unit === 'kg' ? 0.25 : 0.5))
}

export function lastWorking(history: ExerciseSession[]): SessionSet | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const w = history[i].sets.filter((s) => !s.warmup)
    if (w.length) return w[w.length - 1]
  }
}

export interface WeightChips {
  recommended?: number
  options: number[]
}

/** Last working weight (recommended), one step down, one step up, in the active unit. */
export function weightChips(
  history: ExerciseSession[],
  ex: Pick<Exercise, 'step' | 'stepUnit'>,
  unit: Unit,
  suggested?: number,
): WeightChips {
  const step = stepIn(ex, unit)
  const last = lastWorking(history)
  const base = suggested ?? (last ? roundTo(convert(last.weight, last.unit, unit), step) : undefined)
  if (base === undefined) return { options: [] }
  const options = [roundTo(base - step, step), base, roundTo(base + step, step)].filter((w) => w >= 0)
  return { recommended: base, options: [...new Set(options)] }
}

/** Rep chips across the target range, at most 6 of them. */
export function repChips(repMin: number, repMax: number): number[] {
  const all: number[] = []
  for (let r = repMin; r <= repMax; r++) all.push(r)
  if (all.length <= 6) return all
  const picked = new Set<number>()
  for (let i = 0; i < 6; i++) picked.add(all[Math.round((i * (all.length - 1)) / 5)])
  return [...picked]
}
