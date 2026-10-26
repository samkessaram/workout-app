import type { Unit } from '../db'
import { roundTo, stepIn } from '../units'
import { CFG } from './config'
import type { EngineExercise } from './types'

export const midReps = (ex: EngineExercise) => Math.round((ex.repMin + ex.repMax) / 2)

/** The weight added after a success, and whether adding weight is sensible at all. */
export function progressionStep(ex: EngineExercise, weight: number, unit: Unit): { inc: number; feasible: boolean } {
  const step = stepIn(ex, unit)
  const inc = Math.max(step, roundTo(weight * CFG.stepPct[ex.kind], step))
  const feasible = weight > 0 && step <= weight * CFG.maxStepShareOfLoad
  return { inc, feasible }
}
