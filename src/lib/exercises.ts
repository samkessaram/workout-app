import { db, type Equipment, type Exercise, type ExerciseKind, type RestCategory, type Unit } from './db'
import { stepChips } from './units'

export const EQUIPMENT: Equipment[] = ['machine', 'dumbbell', 'cable', 'barbell', 'bodyweight']

export const KINDS: { id: ExerciseKind; label: string; help: string }[] = [
  {
    id: 'compound-lower',
    label: 'Lower compound',
    help: 'A big multi-joint lift that works hips and knees together, like squat, deadlift, leg press or lunges. Your heaviest lifts, so weight jumps are the largest (about 5%) and you add weight nearly every Session at first.',
  },
  {
    id: 'compound-upper',
    label: 'Upper compound',
    help: 'A multi-joint push or pull for the upper body, like bench press, overhead press, rows or pull-ups. Heavy, but the muscles are smaller than your legs, so jumps are smaller (about 2.5%).',
  },
  {
    id: 'machine',
    label: 'Machine',
    help: 'A guided machine with a fixed path, like a chest press machine, leg extension or lat pulldown. Higher reps (8-12) and moderate jumps (about 4%); you add weight once every set hits the top of the range.',
  },
  {
    id: 'isolation',
    label: 'Isolation',
    help: 'Works one joint and one muscle, like curls, lateral raises or triceps pushdowns. Light weights, higher reps (10-15) and the smallest jumps (about 2.5%).',
  },
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
  if (ex.startWeight !== undefined && !(ex.startWeight > 0)) throw new Error('Starting weight must be more than zero')
  const row = { ...ex, name }
  return (await store.exercises.put(row)) as number
}

export async function listExercises(store = db): Promise<Exercise[]> {
  const all = await store.exercises.toArray()
  return all.sort((a, b) => exerciseLabel(a).localeCompare(exerciseLabel(b)))
}

/** How many Sessions have logged Sets for this Exercise. */
export async function exerciseSessionCount(id: number, store = db): Promise<number> {
  return (await store.sessions.toArray()).filter((s) => s.sets.some((x) => x.exerciseId === id)).length
}

/**
 * Removes an Exercise with its Routine entries, planned slots, Pain flags and Suggestion log.
 * Refuses when it has logged Sets: those live inside Sessions and would drop out of History.
 */
export async function deleteExercise(id: number, store = db): Promise<void> {
  await store.transaction('rw', [store.exercises, store.routines, store.sessions, store.painFlags, store.suggestionLog], async () => {
    if ((await exerciseSessionCount(id, store)) > 0) {
      throw new Error('This Exercise has logged Sets, so it can\'t be deleted without erasing that history')
    }
    for (const r of await store.routines.toArray()) {
      if (r.entries.some((e) => e.exerciseId === id)) {
        await store.routines.put({ ...r, entries: r.entries.filter((e) => e.exerciseId !== id) })
      }
    }
    for (const s of await store.sessions.toArray()) {
      if (s.exerciseIds.includes(id)) await store.sessions.put({ ...s, exerciseIds: s.exerciseIds.filter((x) => x !== id) })
    }
    await store.painFlags.where('exerciseId').equals(id).delete()
    await store.suggestionLog.where('exerciseId').equals(id).delete()
    await store.exercises.delete(id)
  })
}
