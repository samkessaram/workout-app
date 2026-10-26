import { convert, roundTo, stepIn } from '../units'
import { CFG } from './config'
import type { EngineExercise, EngineSession } from './types'
import type { Unit } from '../db'

export interface WorkingSet {
  weight: number
  reps: number
}

/** One valid Session of an Exercise, with weights in the active unit. */
export interface Exposure {
  session: EngineSession
  /** The working weight: the most common weight among working Sets, the heaviest on a tie. */
  weight: number
  /** Reps of the Sets at the working weight, in order. */
  reps: number[]
  /** Every working Set, warmups excluded. */
  working: WorkingSet[]
}

/**
 * Valid exposures, oldest first. Warmups are ignored; a Session with fewer working Sets than
 * the Routine target (or the minimum when there is no target) is partial and dropped.
 */
export function toExposures(history: EngineSession[], exercise: EngineExercise, unit: Unit): Exposure[] {
  const step = stepIn(exercise, unit)
  const minSets = exercise.targetSets ?? CFG.minWorkingSets
  const out: Exposure[] = []
  for (const session of [...history].sort((a, b) => a.startedAt - b.startedAt)) {
    const working = session.sets
      .filter((s) => !s.warmup)
      .map((s) => ({ weight: roundTo(convert(s.weight, s.unit, unit), step), reps: s.reps }))
    if (working.length === 0 || working.length < minSets) continue
    const counts = new Map<number, number>()
    for (const s of working) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1)
    const weight = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
    out.push({ session, weight, reps: working.filter((s) => s.weight === weight).map((s) => s.reps), working })
  }
  return out
}
