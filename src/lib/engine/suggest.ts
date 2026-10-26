import { fmtWeight, roundTo, stepIn } from '../units'
import { CFG } from './config'
import { toExposures, type Exposure } from './exposure'
import type { EngineExercise, Stage, SuggestInput, Suggestion } from './types'
import type { Unit } from '../db'

export const midReps = (ex: EngineExercise) => Math.round((ex.repMin + ex.repMax) / 2)

/** The weight added after a top hit, and whether adding weight is sensible at all. */
export function progressionStep(ex: EngineExercise, weight: number, unit: Unit): { inc: number; feasible: boolean } {
  const step = stepIn(ex, unit)
  const inc = Math.max(step, roundTo(weight * CFG.stepPct[ex.kind], step))
  const feasible = weight > 0 && step <= weight * CFG.maxStepShareOfLoad
  return { inc, feasible }
}

function noHistory(ex: EngineExercise, unit: Unit): Suggestion {
  return {
    weight: null,
    unit,
    reps: midReps(ex),
    stage: 'CALIBRATION',
    rule: 'no-history',
    reason: `No history for this Exercise yet. Start conservative: pick a weight you could lift for ${ex.repMax}+ reps.`,
  }
}

function calibration(ex: EngineExercise, exposures: Exposure[], unit: Unit): Suggestion {
  const last = exposures[exposures.length - 1]
  return {
    weight: last.weight,
    unit,
    reps: midReps(ex),
    stage: 'CALIBRATION',
    rule: 'calibration',
    reason: `Calibrating (${exposures.length} of ${CFG.calibrationExposures}): repeat ${fmtWeight(last.weight, unit)} and aim for ${midReps(ex)} reps. No progression yet.`,
  }
}

/** Hold the weight until every working Set reaches the top of the range, then add one increment. */
export function doubleProgression(ex: EngineExercise, last: Exposure, unit: Unit, stage: Stage): Suggestion {
  const w = last.weight
  const lowest = Math.min(...last.reps)
  const base = { unit, stage }

  if (lowest < ex.repMax) {
    return {
      ...base,
      weight: w,
      reps: Math.min(ex.repMax, lowest + 1),
      rule: 'dp-hold',
      reason: `Hold ${fmtWeight(w, unit)}: get every set to ${ex.repMax} (last time ${last.reps.join('/')}).`,
    }
  }

  const { inc, feasible } = progressionStep(ex, w, unit)
  if (!feasible && lowest < ex.repMax + CFG.maxExtraReps) {
    return {
      ...base,
      weight: w,
      reps: lowest + 1,
      rule: 'dp-add-rep',
      reason: `All sets hit ${ex.repMax} at ${fmtWeight(w, unit)}, but the smallest jump (${fmtWeight(stepIn(ex, unit), unit)}) is too big for this load. Add a rep first.`,
    }
  }
  return {
    ...base,
    weight: roundTo(w + inc, stepIn(ex, unit)),
    reps: ex.repMin,
    rule: 'dp-increase',
    reason: `All sets hit ${ex.repMax} at ${fmtWeight(w, unit)}. Add ${fmtWeight(inc, unit)} and restart at ${ex.repMin} reps.`,
  }
}

export function suggest(input: SuggestInput): Suggestion {
  const { exercise, history, unit } = input
  const exposures = toExposures(history, exercise, unit)
  if (exposures.length === 0) return noHistory(exercise, unit)
  if (exposures.length < CFG.calibrationExposures) return calibration(exercise, exposures, unit)
  return doubleProgression(exercise, exposures[exposures.length - 1], unit, 'EARLY_INT')
}
