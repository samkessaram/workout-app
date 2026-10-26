import { db, type Exercise, type Routine, type RoutineEntry, type Session, type SessionType } from './db'

export function entryFor(ex: Exercise, targetSets = 3): RoutineEntry {
  return {
    exerciseId: ex.id!,
    targetSets,
    repMin: ex.repMin,
    repMax: ex.repMax,
    restCategory: ex.restCategory,
  }
}

export async function getRoutine(type: SessionType, store = db): Promise<Routine | undefined> {
  return store.routines.where('sessionType').equals(type).first()
}

export async function saveRoutine(routine: Routine, store = db): Promise<number> {
  const existing = await getRoutine(routine.sessionType, store)
  return (await store.routines.put({ ...routine, id: existing?.id ?? routine.id })) as number
}

export function moveEntry(entries: RoutineEntry[], index: number, dir: -1 | 1): RoutineEntry[] {
  const to = index + dir
  if (to < 0 || to >= entries.length) return entries
  const out = [...entries]
  ;[out[index], out[to]] = [out[to], out[index]]
  return out
}

export interface RoutineDiff {
  added: number[]
  skipped: number[]
}

/** Exercises worked that are not in the Routine, and Routine Exercises with no Sets. */
export function routineDiff(routine: Routine, session: Session): RoutineDiff {
  const planned = routine.entries.map((e) => e.exerciseId)
  const worked = new Set(session.sets.map((s) => s.exerciseId))
  return {
    added: [...worked].filter((id) => !planned.includes(id)),
    skipped: planned.filter((id) => !worked.has(id)),
  }
}

export function diffIsEmpty(d: RoutineDiff): boolean {
  return d.added.length === 0 && d.skipped.length === 0
}

/** Removes skipped Exercises and appends added ones, keeping the rest in order. */
export function applyDiff(routine: Routine, diff: RoutineDiff, exercises: Exercise[]): Routine {
  const kept = routine.entries.filter((e) => !diff.skipped.includes(e.exerciseId))
  const added = diff.added
    .map((id) => exercises.find((e) => e.id === id))
    .filter((e): e is Exercise => !!e)
    .map((e) => entryFor(e))
  return { ...routine, entries: [...kept, ...added] }
}
