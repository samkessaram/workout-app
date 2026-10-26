import { getRoutine } from './routines'
import { db, type Session, type SessionSet, type SessionType, type Unit } from './db'

export const SESSION_TYPES: SessionType[] = ['upper', 'lower', 'rowing', 'other']
export const LOCATIONS = ['gym', 'new gym', 'home']
export const AUTO_CLOSE_MS = 6 * 60 * 60 * 1000

export function todayStr(d = new Date()): string {
  return d.toLocaleDateString('en-CA')
}

export interface StartOptions {
  type: SessionType
  location: string
  trainer: boolean
  timer: boolean
  exerciseIds?: number[]
}

export async function startSession(opts: StartOptions, store = db, now = Date.now()): Promise<number> {
  const session: Session = {
    date: todayStr(new Date(now)),
    type: opts.type,
    location: opts.location,
    trainer: opts.trainer,
    timer: opts.timer,
    startedAt: now,
    exerciseIds: opts.exerciseIds ?? (await getRoutine(opts.type, store))?.entries.map((e) => e.exerciseId) ?? [],
    sets: [],
  }
  return (await store.sessions.add(session)) as number
}

export function lastActivity(s: Session): number {
  return s.sets.reduce((t, x) => Math.max(t, x.at), s.startedAt)
}

/** Closes any Session open for over 6 hours, as it stands. Returns the ids closed. */
export async function autoCloseStale(store = db, now = Date.now()): Promise<number[]> {
  const open = (await store.sessions.toArray()).filter((s) => s.closedAt === undefined)
  const closed: number[] = []
  for (const s of open) {
    if (now - lastActivity(s) > AUTO_CLOSE_MS) {
      await store.sessions.update(s.id!, { closedAt: lastActivity(s) })
      closed.push(s.id!)
    }
  }
  return closed
}

export async function getActiveSession(store = db): Promise<Session | undefined> {
  const open = (await store.sessions.toArray()).filter((s) => s.closedAt === undefined)
  return open.sort((a, b) => b.startedAt - a.startedAt)[0]
}

async function mutate(sessionId: number, store: typeof db, fn: (s: Session) => void): Promise<Session> {
  return store.transaction('rw', store.sessions, async () => {
    const s = await store.sessions.get(sessionId)
    if (!s) throw new Error(`Session ${sessionId} not found`)
    if (s.closedAt !== undefined) throw new Error('Session is closed')
    fn(s)
    await store.sessions.put(s)
    return s
  })
}

export async function addExerciseToSession(sessionId: number, exerciseId: number, store = db) {
  await mutate(sessionId, store, (s) => {
    if (!s.exerciseIds.includes(exerciseId)) s.exerciseIds.push(exerciseId)
  })
}

export interface NewSet {
  exerciseId: number
  weight: number
  unit: Unit
  reps: number
  warmup: boolean
}

export async function addSet(sessionId: number, input: NewSet, store = db, now = Date.now()): Promise<SessionSet> {
  if (input.reps < 1) throw new Error('Reps must be at least 1')
  if (input.weight < 0) throw new Error('Weight cannot be negative')
  const set: SessionSet = { id: crypto.randomUUID(), at: now, ...input }
  await mutate(sessionId, store, (s) => {
    if (!s.exerciseIds.includes(input.exerciseId)) s.exerciseIds.push(input.exerciseId)
    s.sets.push(set)
  })
  return set
}

/**
 * An explicit Correction: the previous value stays on the Set and the new one replaces it.
 * Allowed on closed Sessions too, since mistakes are often noticed later.
 */
export async function correctSet(
  sessionId: number,
  setId: string,
  fix: { weight: number; unit: Unit; reps: number },
  store = db,
  now = Date.now(),
): Promise<void> {
  if (fix.reps < 1) throw new Error('Reps must be at least 1')
  if (fix.weight < 0) throw new Error('Weight cannot be negative')
  await store.transaction('rw', store.sessions, async () => {
    const s = await store.sessions.get(sessionId)
    const set = s?.sets.find((x) => x.id === setId)
    if (!s || !set) throw new Error('Set not found')
    if (set.weight === fix.weight && set.unit === fix.unit && set.reps === fix.reps) return
    set.prev = [...(set.prev ?? []), { weight: set.weight, unit: set.unit, reps: set.reps, at: now }]
    set.weight = fix.weight
    set.unit = fix.unit
    set.reps = fix.reps
    await store.sessions.put(s)
  })
}

export async function closeSession(sessionId: number, store = db, now = Date.now()): Promise<Session> {
  return mutate(sessionId, store, (s) => {
    s.closedAt = now
  })
}

export function setsFor(s: Session, exerciseId: number): SessionSet[] {
  return s.sets.filter((x) => x.exerciseId === exerciseId)
}

export function workingSets(sets: SessionSet[]): SessionSet[] {
  return sets.filter((x) => !x.warmup)
}
