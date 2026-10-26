import Dexie, { type EntityTable } from 'dexie'

export type Unit = 'lb' | 'kg'
export type Equipment = 'machine' | 'dumbbell' | 'cable' | 'barbell' | 'bodyweight'
export type SessionType = 'upper' | 'lower' | 'rowing' | 'other'
export type RestCategory = 'heavy' | 'moderate' | 'isolation'

export interface Exercise {
  id?: number
  name: string
  equipment: Equipment
  step?: number
  repMin?: number
  repMax?: number
  restCategory?: RestCategory
  stage?: 'CALIBRATION' | 'NOVICE' | 'EARLY_INT'
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

export interface SessionSet {
  exerciseId: number
  weight: number
  unit: Unit
  reps: number
  warmup: boolean
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
  sets: SessionSet[]
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
