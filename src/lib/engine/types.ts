import type { ExerciseKind, Unit } from '../db'

export type Stage = 'CALIBRATION' | 'NOVICE' | 'EARLY_INT'

export interface EngineSet {
  weight: number
  unit: Unit
  reps: number
  warmup: boolean
}

/** One Session's worth of one Exercise. Structurally compatible with `ExerciseSession`. */
export interface EngineSession {
  sessionId: number
  date: string
  startedAt: number
  location: string
  sets: EngineSet[]
  /** Exercise-level and Set-level chips merged. */
  chips: string[]
}

export interface EngineExercise {
  kind: ExerciseKind
  step: number
  stepUnit: Unit
  /** Lifter-chosen first weight, in `stepUnit`. */
  startWeight?: number
  repMin: number
  repMax: number
  /** Routine target sets, if the Exercise is in a Routine. Shorter Sessions are partial. */
  targetSets?: number
}

export interface SuggestInput {
  exercise: EngineExercise
  history: EngineSession[]
  /** The unit Suggestions are expressed in. */
  unit: Unit
  now?: number
  /** Location of the Session being planned. */
  location?: string
  /** Past and current deload windows, in epoch ms. Sessions inside one are ignored; inside the current one loads drop. */
  deloads?: { from: number; until: number }[]
}

export interface Suggestion {
  /** Null when there is no history to compute from: the app never invents a number. */
  weight: number | null
  unit: Unit
  reps: number
  /** One line, shown to the lifter. */
  reason: string
  rule: string
  stage: Stage
}
