import type { Equipment, Exercise, ExerciseKind, Unit } from '../db'
import { KIND_DEFAULTS, defaultStep } from '../exercises'
import type { LegacySession } from './parse'

export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export interface PlanItem {
  /** Stable id for this legacy exercise: normalised name plus equipment. */
  id: string
  name: string
  equipment?: Equipment
  /** Number of sets in the export, to help the lifter judge importance. */
  sets: number
  /** The existing Exercise it maps to without asking, if exactly one fits. */
  matchedId?: number
}

export function itemId(name: string, equipment?: Equipment): string {
  return `${nameKey(name)}|${equipment ?? ''}`
}

/** Unique legacy exercises in the export, each matched to the library where unambiguous. */
export function planImport(sessions: LegacySession[], library: Exercise[]): PlanItem[] {
  const items = new Map<string, PlanItem>()
  for (const s of sessions) {
    for (const e of s.exercises) {
      const id = itemId(e.name, e.equipment)
      const item = items.get(id) ?? { id, name: e.name, equipment: e.equipment, sets: 0 }
      item.sets += e.sets.length
      items.set(id, item)
    }
  }
  for (const item of items.values()) {
    const candidates = library.filter(
      (x) => nameKey(x.name) === nameKey(item.name) && (item.equipment === undefined || x.equipment === item.equipment),
    )
    if (candidates.length === 1) item.matchedId = candidates[0].id
  }
  return [...items.values()].sort((a, b) => b.sets - a.sets)
}

/** A best guess at kind from the name and equipment. Always editable afterwards. */
export function guessKind(name: string, equipment?: Equipment): ExerciseKind {
  const n = nameKey(name)
  if (/\b(squat|deadlift|rdl|romanian|lunge|hip thrust|good morning|step up)\b/.test(n)) {
    return equipment === 'machine' ? 'machine' : 'compound-lower'
  }
  if (/\b(curl|raise|extension|fly|flye|pushdown|kickback|abduct|adduct|shrug|face pull|crunch|calf)\b/.test(n)) return 'isolation'
  if (equipment === 'machine' || equipment === 'cable') return 'machine'
  if (/\b(bench|press|row|pulldown|pull up|pullup|chin|dip|push up)\b/.test(n)) return 'compound-upper'
  return equipment === 'bodyweight' ? 'compound-upper' : 'machine'
}

export function draftExercise(name: string, equipment: Equipment | undefined, unit: Unit): Exercise {
  const kind = guessKind(name, equipment)
  const d = KIND_DEFAULTS[kind]
  return {
    name: name.trim(),
    equipment: equipment ?? (kind === 'isolation' ? 'dumbbell' : 'machine'),
    kind,
    step: defaultStep(unit),
    stepUnit: unit,
    repMin: d.repMin,
    repMax: d.repMax,
    restCategory: d.rest,
    bodyAreas: [],
  }
}
