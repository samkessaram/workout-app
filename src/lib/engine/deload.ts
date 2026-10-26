import { CFG } from './config'

const DAY = 24 * 60 * 60 * 1000

/** What the detector needs to know about one Exercise's recent history. */
export interface DeloadCandidate {
  exerciseId: number
  name: string
  muscle?: string
  /** Start times of Stalls that counted (not confounded, not during a re-ramp). */
  stalls: number[]
  /** Valid exposures, oldest first, with confounded ones already removed. */
  exposures: { startedAt: number; weight: number; avgReps: number }[]
}

export interface DeloadAdvice {
  kind: 'stalls' | 'reps'
  muscle?: string
  exerciseId?: number
  reason: string
}

/**
 * A reactive deload is only ever suggested, never forced. Two triggers:
 * 3+ stalled Exercises for one muscle within 14 days, or average reps 15%+ below the
 * 4-week best at the same weight.
 */
export function detectDeload(candidates: DeloadCandidate[], now: number): DeloadAdvice | undefined {
  const c = CFG.deload
  const byMuscle = new Map<string, DeloadCandidate[]>()
  for (const cand of candidates) {
    if (!cand.muscle) continue
    if (cand.stalls.some((t) => now - t <= c.windowDays * DAY)) {
      byMuscle.set(cand.muscle, [...(byMuscle.get(cand.muscle) ?? []), cand])
    }
  }
  for (const [muscle, list] of byMuscle) {
    if (list.length >= c.stalledLiftsSameMuscle) {
      return {
        kind: 'stalls',
        muscle,
        reason: `${list.length} ${muscle} exercises stalled in the last ${c.windowDays} days (${list.map((x) => x.name).join(', ')}).`,
      }
    }
  }

  for (const cand of candidates) {
    const e = cand.exposures
    const latest = e[e.length - 1]
    if (!latest || now - latest.startedAt > c.windowDays * DAY) continue
    const best = Math.max(
      0,
      ...e
        .filter((x) => x !== latest && x.weight === latest.weight && latest.startedAt - x.startedAt <= c.bestWindowDays * DAY)
        .map((x) => x.avgReps),
    )
    if (best > 0 && latest.avgReps <= best * (1 - c.repDropPct)) {
      const pct = Math.round((1 - latest.avgReps / best) * 100)
      return {
        kind: 'reps',
        exerciseId: cand.exerciseId,
        muscle: cand.muscle,
        reason: `${cand.name}: reps are down ${pct}% from your 4-week best at the same weight.`,
      }
    }
  }
}
