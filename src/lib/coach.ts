import { db, type Exercise, type PainFlag, type RoutineEntry, type Session, type Unit } from './db'
import { suggest } from './engine/suggest'
import type { EngineExercise, Suggestion } from './engine/types'
import { exerciseHistory } from './history'
import { flagsRelevantTo, openFlags } from './pain'
import { getRoutine } from './routines'

/** The Exercise as the engine sees it: Routine targets override the Exercise defaults. */
export function engineExercise(ex: Exercise, entry?: RoutineEntry): EngineExercise {
  return {
    kind: ex.kind,
    step: ex.step,
    stepUnit: ex.stepUnit,
    repMin: entry?.repMin ?? ex.repMin,
    repMax: entry?.repMax ?? ex.repMax,
    targetSets: entry?.targetSets,
  }
}

export async function suggestionFor(
  exerciseId: number,
  session: Session,
  unit: Unit,
  store = db,
  now = Date.now(),
): Promise<Suggestion | undefined> {
  const ex = await store.exercises.get(exerciseId)
  if (!ex) return undefined
  const routine = await getRoutine(session.type, store)
  const entry = routine?.entries.find((e) => e.exerciseId === exerciseId)
  const history = await exerciseHistory(exerciseId, store, { excludeSessionId: session.id })
  return suggest({ exercise: engineExercise(ex, entry), history, unit, now, location: session.location })
}

/** Writes the Suggestion to `suggestionLog` once per Session and Exercise. */
export async function logSuggestion(sessionId: number, exerciseId: number, s: Suggestion, store = db) {
  const existing = await store.suggestionLog.where('sessionId').equals(sessionId).filter((e) => e.exerciseId === exerciseId).first()
  if (existing) return existing.id!
  return (await store.suggestionLog.add({
    sessionId,
    exerciseId,
    stage: s.stage,
    rule: s.rule,
    suggested: { weight: s.weight, unit: s.unit, reps: s.reps },
  })) as number
}

/** Records what was actually lifted (working Sets) beside the Suggestion, if one was logged. */
export async function recordActual(sessionId: number, exerciseId: number, store = db) {
  const entry = await store.suggestionLog.where('sessionId').equals(sessionId).filter((e) => e.exerciseId === exerciseId).first()
  const session = await store.sessions.get(sessionId)
  if (!entry || !session) return
  const actual = session.sets
    .filter((s) => s.exerciseId === exerciseId && !s.warmup)
    .map((s) => ({ weight: s.weight, unit: s.unit, reps: s.reps }))
  await store.suggestionLog.update(entry.id!, { actual })
}

export interface Brief {
  lastSessions: Session[]
  items: { exerciseId: number; suggestion: Suggestion }[]
  flags: PainFlag[]
}

/** Last 1-2 Sessions of this type, today's Suggestions, and open Pain flags that apply. */
export async function buildBrief(session: Session, unit: Unit, store = db, now = Date.now()): Promise<Brief> {
  const sessions = await store.sessions.toArray()
  const lastSessions = sessions
    .filter((s) => s.type === session.type && s.id !== session.id && s.sets.length > 0)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 2)
  const items: Brief['items'] = []
  const exercises: Exercise[] = []
  for (const id of session.exerciseIds) {
    const suggestion = await suggestionFor(id, session, unit, store, now)
    const ex = await store.exercises.get(id)
    if (suggestion) items.push({ exerciseId: id, suggestion })
    if (ex) exercises.push(ex)
  }
  const open = await openFlags(store)
  const flags = open.filter((f) => exercises.some((ex) => flagsRelevantTo(ex, [f]).length > 0))
  return { lastSessions, items, flags }
}
