import Dexie, { type EntityTable } from 'dexie'

export type Unit = 'lb' | 'kg'
export type Equipment = 'machine' | 'dumbbell' | 'cable' | 'barbell' | 'bodyweight'
export type SessionType = 'upper' | 'lower' | 'rowing' | 'other'
export type RestCategory = 'heavy' | 'moderate' | 'isolation'
export type ExerciseKind = 'compound-lower' | 'compound-upper' | 'machine' | 'isolation'

export interface Exercise {
  id?: number
  name: string
  equipment: Equipment
  kind: ExerciseKind
  /** Smallest loadable jump, in `stepUnit`. */
  step: number
  stepUnit: Unit
  repMin: number
  repMax: number
  restCategory: RestCategory
  muscle?: string
  bodyAreas: string[]
}

export interface RoutineEntry {
  exerciseId: number
  targetSets: number
  repMin: number
  repMax: number
  restCategory: RestCategory
}

export interface Routine {
  id?: number
  sessionType: SessionType
  entries: RoutineEntry[]
}

export interface SetValue {
  weight: number
  unit: Unit
  reps: number
  at: number
}

export interface SessionSet {
  id: string
  exerciseId: number
  weight: number
  unit: Unit
  reps: number
  warmup: boolean
  at: number
  /** Superseded values, oldest first. Set only by an explicit Correction. */
  prev?: SetValue[]
  chips?: string[]
  note?: string
}

export interface Session {
  id?: number
  date: string
  type: SessionType
  location: string
  trainer: boolean
  timer: boolean
  startedAt: number
  closedAt?: number
  /** Exercises in the order planned or worked. */
  exerciseIds: number[]
  sets: SessionSet[]
  exerciseChips?: Record<number, string[]>
  exerciseNotes?: Record<number, string>
  /** Per-Location baseline answers: `${exerciseId}` -> 'same' | 'new'. */
  baselineAnswers?: Record<number, 'same' | 'new'>
  nextTargets?: { exerciseId: number; text: string }[]
  /** Set on imported legacy Sessions so re-importing the same export skips them. */
  legacyKey?: string
}

export interface PainFlag {
  id?: number
  exerciseId: number
  bodyArea?: string
  severity: 'sharp' | 'dull'
  action: 'stop' | 'continue'
  createdAt: number
  resolvedAt?: number
}

export interface SuggestionLogEntry {
  id?: number
  sessionId: number
  exerciseId: number
  stage: string
  rule: string
  suggested: unknown
  actual?: unknown
}

export interface Setting {
  key: string
  value: unknown
}

export const SCHEMA_VERSION = 1

export class WorkoutDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  sessions!: EntityTable<Session, 'id'>
  painFlags!: EntityTable<PainFlag, 'id'>
  suggestionLog!: EntityTable<SuggestionLogEntry, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'workout') {
    super(name)
    this.version(SCHEMA_VERSION).stores({
      exercises: '++id, name, equipment',
      routines: '++id, sessionType',
      sessions: '++id, date, type, closedAt',
      painFlags: '++id, exerciseId, bodyArea, resolvedAt',
      suggestionLog: '++id, sessionId, exerciseId',
      settings: 'key',
    })
  }
}

export const db = new WorkoutDB()
