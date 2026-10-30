import { convert, fmtWeight, roundTo, stepIn } from '../units'
import { CFG } from './config'
import { toExposures, type Exposure } from './exposure'
import { analyze, isStall, layoffState, noviceTarget, repDrop, type Analysis } from './stages'
import { midReps, progressionStep } from './util'
import type { EngineExercise, Stage, SuggestInput, Suggestion } from './types'
import type { Unit } from '../db'

function noHistory(ex: EngineExercise, unit: Unit): Suggestion {
  if (ex.startWeight !== undefined && ex.startWeight > 0) {
    const weight = roundTo(convert(ex.startWeight, ex.stepUnit, unit), stepIn(ex, unit))
    return {
      weight,
      unit,
      reps: midReps(ex),
      stage: 'CALIBRATION',
      rule: 'starting-weight',
      reason: `First time: start at ${fmtWeight(weight, unit)} and aim for ${midReps(ex)} reps.`,
    }
  }
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

/** 5% off the working load, if that is loadable; else the load stays and the variation should change. */
function dropFive(ex: EngineExercise, w: number, unit: Unit): number {
  const dropped = roundTo(w * (1 - CFG.swapDropPct), stepIn(ex, unit))
  return dropped < w ? dropped : w
}

function swap(ex: EngineExercise, a: Analysis, unit: Unit): Suggestion {
  const w = a.last.weight
  const to = dropFive(ex, w, unit)
  const why = a.run >= 3 ? `${a.run} stalls in a row` : `reps fell ${a.last.reps[0] - a.last.reps[a.last.reps.length - 1]} across sets`
  return {
    weight: to,
    unit,
    stage: a.stage,
    reps: a.stage === 'NOVICE' ? noviceTarget(ex) : ex.repMin,
    rule: 'stall-swap',
    reason:
      to < w
        ? `${why}: swap the variation, or drop 5% to ${fmtWeight(to, unit)}.`
        : `${why}: swap the variation (a 5% drop is not loadable at ${fmtWeight(w, unit)}).`,
  }
}

function ignoredStall(a: Analysis, base: Suggestion): Suggestion {
  return {
    ...base,
    rule: 'stall-ignored',
    reason: `Missed the target, but "${a.ignored}" was flagged, so it does not count as a stall. Repeat ${fmtWeight(base.weight ?? 0, base.unit)}.`,
  }
}

/** NOVICE: linear progression on compounds. Add weight whenever every Set hits the target. */
function novice(ex: EngineExercise, a: Analysis, unit: Unit): Suggestion {
  const w = a.last.weight
  const step = stepIn(ex, unit)
  const target = noviceTarget(ex)
  const repeat: Suggestion = { weight: w, unit, reps: target, stage: 'NOVICE', rule: 'stall-repeat', reason: '' }

  if (a.ignored) return ignoredStall(a, repeat)
  if (a.run === 0) {
    if (isStall('NOVICE', ex, a.last, a.prev)) {
      return { ...repeat, rule: 'novice-repeat', reason: `Target of ${target} not met on every set last time: repeat ${fmtWeight(w, unit)}.` }
    }
    // Linear jumps are fixed loads, so the "is the step a sensible share of the load" check does not apply.
    const { inc } = progressionStep(ex, w, unit)
    return {
      ...repeat,
      weight: roundTo(w + inc, step),
      rule: 'novice-increase',
      reason: `Every set hit ${target}+ at ${fmtWeight(w, unit)}. Add ${fmtWeight(inc, unit)}.`,
    }
  }
  if (a.run >= 3 || repDrop(a.last)) return swap(ex, a, unit)
  if (a.run === 2) {
    const pct = CFG.novice.resetPct.compound
    let to = roundTo(w * (1 - pct), step)
    if (to >= w) to = Math.max(0, w - step)
    return { ...repeat, weight: to, rule: 'stall-reset', reason: `Second stall in a row: reset ${Math.round(pct * 100)}% to ${fmtWeight(to, unit)} and rebuild.` }
  }
  return { ...repeat, reason: `Missed the target of ${target} last time (stall 1): repeat ${fmtWeight(w, unit)}.` }
}

/** EARLY_INT: double progression, with the stall ladder layered on top. */
function earlyInt(ex: EngineExercise, a: Analysis, unit: Unit): Suggestion {
  const dp = doubleProgression(ex, a.last, unit, 'EARLY_INT')
  if (a.ignored) return ignoredStall(a, dp)
  if (a.run === 0) return dp
  if (a.run >= 3 || repDrop(a.last)) return swap(ex, a, unit)
  if (a.run === 2) {
    return {
      ...dp,
      reps: Math.max(ex.repMin, dp.reps - 1),
      rule: 'stall-lower-target',
      reason: `Second stall in a row at ${fmtWeight(dp.weight ?? 0, unit)}: hold it and aim a rep lower.`,
    }
  }
  return { ...dp, rule: 'stall-repeat', reason: `Stalled once at ${fmtWeight(dp.weight ?? 0, unit)}: repeat it and look for a cause. ${dp.reason}` }
}

/** After a layoff: 87.5% of the last working weight, stepping back to full load over up to 3 Sessions. */
function reRamp(ex: EngineExercise, a: Analysis, unit: Unit, state: { preWeight: number; m: number }): Suggestion | undefined {
  const factor = CFG.reRamp.factors[state.m]
  const step = stepIn(ex, unit)
  const target = roundTo(state.preWeight * factor, step)
  if (state.m > 0 && a.last.weight >= target) return undefined // already back at or above the ramp: normal rules
  return {
    weight: target,
    unit,
    stage: a.stage,
    reps: midReps(ex),
    rule: 're-ramp',
    reason:
      state.m === 0
        ? `Back after a layoff: start at ${Math.round(factor * 1000) / 10}% of ${fmtWeight(state.preWeight, unit)} and build back over ${CFG.reRamp.factors.length} sessions. No stalls count.`
        : `Re-ramp, session ${state.m + 1} of ${CFG.reRamp.factors.length}: ${Math.round(factor * 1000) / 10}% of ${fmtWeight(state.preWeight, unit)}. No stalls count.`,
  }
}

export function suggest(input: SuggestInput): Suggestion {
  const { exercise, unit } = input
  const now = input.now ?? Date.now()
  const deloads = input.deloads ?? []
  const inDeload = (t: number) => deloads.some((d) => t >= d.from && t <= d.until)
  // Sessions done during a deload say nothing about working loads.
  const history = input.history.filter((h) => !inDeload(h.startedAt))
  const exposures = toExposures(history, exercise, unit)
  if (exposures.length === 0) return noHistory(exercise, unit)
  if (exposures.length < CFG.calibrationExposures) return calibration(exercise, exposures, unit)

  const lastDeloadEnd = Math.max(-Infinity, ...deloads.filter((d) => d.until < now).map((d) => d.until))
  const a = analyze(exercise, exposures, unit, lastDeloadEnd)
  const layoff = layoffState(exposures, now)
  let s = (layoff && reRamp(exercise, a, unit, layoff)) || (a.stage === 'NOVICE' ? novice(exercise, a, unit) : earlyInt(exercise, a, unit))

  const active = deloads.find((d) => now >= d.from && now <= d.until)
  if (active && s.weight !== null) {
    const step = stepIn(exercise, unit)
    const to = Math.min(roundTo(s.weight * CFG.deload.loadFactor, step), s.weight)
    s = { ...s, weight: to, rule: 'deload', reason: `Deload week: ${Math.round(CFG.deload.loadFactor * 100)}% load at ${fmtWeight(to, unit)}, half the sets, stop with reps in reserve.` }
  }
  return s
}
