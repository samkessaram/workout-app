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

export function routineLabel(r: Pick<Routine, 'name' | 'sessionType'>): string {
  return r.name?.trim() || r.sessionType.charAt(0).toUpperCase() + r.sessionType.slice(1)
}

export async function getRoutine(id: number, store = db): Promise<Routine | undefined> {
  return store.routines.get(id)
}

/** Routines of one Session type (or all), in the order they were created. */
export async function listRoutines(type?: SessionType, store = db): Promise<Routine[]> {
  const all = type ? await store.routines.where('sessionType').equals(type).toArray() : await store.routines.toArray()
  return all.sort((a, b) => a.id! - b.id!)
}

/** The Routine a Session started from. Sessions from before Routines were named fall back to the first of their type. */
export async function routineForSession(session: Session, store = db): Promise<Routine | undefined> {
  if (session.routineId !== undefined) return store.routines.get(session.routineId)
  return (await listRoutines(session.type, store))[0]
}

/** In a rotation (Upper A, Upper B, ...), the Routine of this type done longest ago; never-done ones come first. */
export async function nextRoutine(type: SessionType, store = db): Promise<Routine | undefined> {
  const routines = await listRoutines(type, store)
  if (routines.length < 2) return routines[0]
  const lastUsed = new Map<number, number>()
  for (const s of await store.sessions.where('type').equals(type).toArray()) {
    if (s.routineId !== undefined) lastUsed.set(s.routineId, Math.max(lastUsed.get(s.routineId) ?? -Infinity, s.startedAt))
  }
  return routines.reduce((best, r) => ((lastUsed.get(r.id!) ?? -Infinity) < (lastUsed.get(best.id!) ?? -Infinity) ? r : best))
}

export async function saveRoutine(routine: Routine, store = db): Promise<number> {
  return (await store.routines.put(routine)) as number
}

/** Past Sessions keep their record; they just no longer point at a Routine. */
export async function deleteRoutine(id: number, store = db): Promise<void> {
  await store.routines.delete(id)
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
