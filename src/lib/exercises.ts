import { db, type Equipment, type Exercise, type ExerciseKind, type RestCategory, type Unit } from './db'
import { stepChips } from './units'

export const EQUIPMENT: Equipment[] = ['machine', 'dumbbell', 'cable', 'barbell', 'bodyweight']

export const KINDS: { id: ExerciseKind; label: string }[] = [
  { id: 'compound-lower', label: 'Lower compound' },
  { id: 'compound-upper', label: 'Upper compound' },
  { id: 'machine', label: 'Machine' },
  { id: 'isolation', label: 'Isolation' },
]

export const MUSCLES = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core',
]
export const JOINTS = ['neck', 'shoulder', 'elbow', 'wrist', 'lower back', 'hip', 'knee', 'ankle']
export const BODY_AREAS = [...new Set([...MUSCLES, ...JOINTS])]

export const REST_CATEGORIES: RestCategory[] = ['heavy', 'moderate', 'isolation']
export const REST_SECONDS: Record<RestCategory, number> = { heavy: 120, moderate: 90, isolation: 60 }

/** Spec defaults: rep ranges and rest category per kind. Step percentages live in the engine config. */
export const KIND_DEFAULTS: Record<
  ExerciseKind,
  { repMin: number; repMax: number; rest: RestCategory; compound: boolean }
> = {
  'compound-lower': { repMin: 6, repMax: 10, rest: 'heavy', compound: true },
  'compound-upper': { repMin: 6, repMax: 10, rest: 'heavy', compound: true },
  machine: { repMin: 8, repMax: 12, rest: 'moderate', compound: false },
  isolation: { repMin: 10, repMax: 15, rest: 'isolation', compound: false },
}

export function defaultStep(unit: Unit): number {
  return unit === 'lb' ? 5 : 2.5
}

export function newExercise(unit: Unit): Exercise {
  const d = KIND_DEFAULTS['compound-upper']
  return {
    name: '',
    equipment: 'barbell',
    kind: 'compound-upper',
    step: defaultStep(unit),
    stepUnit: unit,
    repMin: d.repMin,
    repMax: d.repMax,
    restCategory: d.rest,
    bodyAreas: [],
  }
}

export function exerciseLabel(e: Pick<Exercise, 'name' | 'equipment'>): string {
  return `${e.name} (${e.equipment})`
}

export function isCompound(e: Pick<Exercise, 'kind'>): boolean {
  return KIND_DEFAULTS[e.kind].compound
}

export function stepOptions(unit: Unit): number[] {
  return stepChips(unit)
}

export async function saveExercise(ex: Exercise, store = db): Promise<number> {
  const name = ex.name.trim()
  if (!name) throw new Error('Exercise needs a name')
  if (ex.repMin > ex.repMax) throw new Error('Rep range is inverted')
  const clash = (await store.exercises.where('name').equalsIgnoreCase(name).toArray()).find(
    (e) => e.equipment === ex.equipment && e.id !== ex.id,
  )
  if (clash) throw new Error(`${exerciseLabel(clash)} already exists`)
  const row = { ...ex, name }
  return (await store.exercises.put(row)) as number
}

export async function listExercises(store = db): Promise<Exercise[]> {
  const all = await store.exercises.toArray()
  return all.sort((a, b) => exerciseLabel(a).localeCompare(exerciseLabel(b)))
}
