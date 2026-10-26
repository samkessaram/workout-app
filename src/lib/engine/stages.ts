import { hasConfounder, isConfounder } from '../chipDefs'
import type { Unit } from '../db'
import { CFG } from './config'
import type { Exposure } from './exposure'
import { midReps } from './util'
import type { EngineExercise, Stage } from './types'

const DAY = 24 * 60 * 60 * 1000

export function isCompoundKind(ex: Pick<EngineExercise, 'kind'>): boolean {
  return CFG.compoundKinds.includes(ex.kind)
}

/** Epley estimate. A trend metric only. */
export const e1rm = (weight: number, reps: number) => weight * (1 + reps / 30)

export function bestE1rm(e: Exposure): number {
  return Math.max(...e.working.map((s) => e1rm(s.weight, s.reps)))
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Reps the NOVICE target asks of every Set. */
export const noviceTarget = (ex: EngineExercise) => (CFG.novice.targetIsMidRange ? midReps(ex) : ex.repMax)

/**
 * A Stall is an exposure that missed its target.
 * NOVICE: any Set below the target reps.
 * EARLY_INT: no rep progress at the same weight without a top hit, or a Set below the bottom of
 * the range at a weight already raised. A lower weight than last time is a reset, not a Stall.
 */
export function isStall(stage: Stage, ex: EngineExercise, cur: Exposure, prev: Exposure | undefined): boolean {
  if (stage === 'NOVICE') return Math.min(...cur.reps) < noviceTarget(ex)
  if (!prev) return false
  if (cur.weight < prev.weight) return false
  if (cur.weight > prev.weight) return Math.min(...cur.reps) < ex.repMin
  const topHit = Math.min(...cur.reps) >= ex.repMax
  return !topHit && avg(cur.reps) <= avg(prev.reps)
}

/** Whether the first-to-last Set rep drop is big enough to jump to the third rung. */
export function repDrop(e: Exposure): boolean {
  return e.reps.length >= 2 && e.reps[0] - e.reps[e.reps.length - 1] >= CFG.repDropToSwap
}

/** Least-squares e1RM slope over the recent window, as a share of mean load per week. */
export function e1rmSlopePctPerWeek(exposures: Exposure[]): number | undefined {
  const c = CFG.novice
  const last = exposures[exposures.length - 1].session.startedAt
  const win = exposures.filter((e) => last - e.session.startedAt <= c.slopeWindowDays * DAY)
  if (win.length < c.slopeMinExposures) return undefined
  const t0 = win[0].session.startedAt
  if ((last - t0) / DAY < c.slopeMinSpanDays) return undefined
  const xs = win.map((e) => (e.session.startedAt - t0) / DAY)
  const ys = win.map(bestE1rm)
  const mx = avg(xs)
  const my = avg(ys)
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0)
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  if (den === 0) return undefined
  return ((num / den) * 7) / my
}

export interface Analysis {
  stage: Stage
  /** Consecutive counted Stalls ending at the latest exposure. Confounded Stalls neither count nor break the run. */
  run: number
  /** The latest exposure missed its target but carried a confounder chip, so it was not counted. */
  ignored?: string
  /** The latest exposure stalled (counted or not). */
  lastStalled: boolean
  last: Exposure
  prev?: Exposure
}

/**
 * Replays the exposures in order to find the current Stage and Stall run. Stage is sticky:
 * once a lift leaves NOVICE it does not return.
 */
export function analyze(ex: EngineExercise, exposures: Exposure[], unit: Unit): Analysis {
  void unit
  const cal = CFG.calibrationExposures
  const compound = isCompoundKind(ex)
  let stage: Stage = compound ? 'NOVICE' : 'EARLY_INT'
  let run = 0
  let ignored: string | undefined
  let lastStalled = false
  const resets: number[] = []

  for (let i = cal; i < exposures.length; i++) {
    const cur = exposures[i]
    const stalled = isStall(stage, ex, cur, exposures[i - 1])
    ignored = undefined
    if (!stalled) run = 0
    else if (hasConfounder(cur.session.chips)) ignored = cur.session.chips.find(isConfounder)
    else {
      run++
      if (stage === 'NOVICE' && run === 2) resets.push(cur.session.startedAt)
    }
    lastStalled = stalled

    if (stage === 'NOVICE') {
      const c = CFG.novice
      const upTo = exposures.slice(0, i + 1)
      const gate = (cur.session.startedAt - exposures[0].session.startedAt) / DAY >= c.gateDays
      const recentResets = resets.filter((t) => cur.session.startedAt - t <= c.resetWindowDays * DAY).length
      const slope = e1rmSlopePctPerWeek(upTo)
      const leave = run >= c.stallsToLeave || recentResets >= c.resetsToLeave || (slope !== undefined && slope < c.slopeFloorPctPerWeek)
      if (gate && leave) {
        stage = 'EARLY_INT'
        run = 0
        ignored = undefined
      }
    }
  }
  const last = exposures[exposures.length - 1]
  return { stage, run, ignored, lastStalled, last, prev: exposures[exposures.length - 2] }
}
