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
}
