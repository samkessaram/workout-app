import type { ExerciseKind } from '../db'

/**
 * Tunable defaults from the progression research (all [O] there: engineering choices, not findings).
 * `suggestionLog` records every Suggestion so these can be tuned against real history.
 */
export const CFG = {
  /** Working Sets an Exercise needs in a Session to count, when no Routine target is known. */
  minWorkingSets: 1,
  /** Exposures before stage logic applies. */
  calibrationExposures: 3,
  /** Progression step as a share of the working load, rounded to the Exercise's smallest step. */
  stepPct: {
    'compound-lower': 0.05,
    'compound-upper': 0.025,
    machine: 0.04,
    isolation: 0.025,
  } satisfies Record<ExerciseKind, number>,
  /** The smallest step may be at most this share of the load, else add reps instead. */
  maxStepShareOfLoad: 0.1,
  /** Reps may run this far past the top of the range while waiting for a feasible step. */
  maxExtraReps: 3,

  /** NOVICE (linear) progression applies to these kinds; everything else starts on double progression. */
  compoundKinds: ['compound-lower', 'compound-upper'] as ExerciseKind[],
  novice: {
    /** NOVICE "target met" means every working Set reaches the middle of the rep range. [O] */
    targetIsMidRange: true,
    /** Load dropped on the second consecutive stall, by kind of lift. */
    resetPct: { compound: 0.1, isolation: 0.05 },
    /** Leaving NOVICE needs this much history on the lift... */
    gateDays: 8 * 7,
    /** ...and any one of: this many consecutive stalls (after the automatic reset at 2)... */
    stallsToLeave: 4,
    /** ...this many resets inside the window... */
    resetsToLeave: 3,
    resetWindowDays: 12 * 7,
    /** ...or an e1RM slope under this share of load per week over the window. */
    slopeFloorPctPerWeek: 0.005,
    slopeWindowDays: 6 * 7,
    slopeMinExposures: 4,
    slopeMinSpanDays: 14,
  },
  /** Third rung of the stall ladder: drop this much load (or swap the variation). */
  swapDropPct: 0.05,
  /** A rep drop of this many reps from first to last Set, on a stalled exposure, jumps to the third rung. */
  repDropToSwap: 2,

  reRamp: {
    /** A gap this long on an Exercise starts a re-ramp. */
    layoffDays: 21,
    /** Share of the last working weight for each Session back; the last entry is full load. Then normal rules resume. */
    factors: [0.875, 0.9375, 1.0],
  },
  deload: {
    /** Reactive trigger: this many stalled Exercises for one muscle within the window. */
    stalledLiftsSameMuscle: 3,
    windowDays: 14,
    /** Reactive trigger: average reps this far below the 4-week best at the same weight. */
    repDropPct: 0.15,
    bestWindowDays: 28,
    /** What an accepted deload does. */
    days: 7,
    setFactor: 0.5,
    loadFactor: 0.9,
    /** After a dismissal, do not suggest again for this long. */
    snoozeDays: 14,
  },
  /** An Exercise at a new Location that differs this much from the Suggestion triggers the baseline question. */
  baselineDeviation: 0.15,
}
