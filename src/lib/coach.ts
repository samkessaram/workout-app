import { db, type Exercise, type PainFlag, type RoutineEntry, type Session, type Unit } from './db'
import { suggest } from './engine/suggest'
import type { EngineExercise, Suggestion } from './engine/types'
import { applyBaseline, exerciseHistory } from './history'
import { CFG } from './engine/config'
import { detectDeload, type DeloadAdvice, type DeloadCandidate } from './engine/deload'
import { toExposures } from './engine/exposure'
import { analyze } from './engine/stages'
import { hasConfounder } from './chipDefs'
import { getSetting, setSetting } from './settings.svelte'
import { flagsRelevantTo, openFlags } from './pain'
import { getRoutine } from './routines'

/** The Exercise as the engine sees it: Routine targets override the Exercise defaults. */
export function engineExercise(ex: Exercise, entry?: RoutineEntry): EngineExercise {
  return {
    kind: ex.kind,
    step: ex.step,
    stepUnit: ex.stepUnit,
    startWeight: ex.startWeight,
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
  now = session.startedAt,
): Promise<Suggestion | undefined> {
  const ex = await store.exercises.get(exerciseId)
  if (!ex) return undefined
  const routine = await getRoutine(session.type, store)
  const entry = routine?.entries.find((e) => e.exerciseId === exerciseId)
  const all = await exerciseHistory(exerciseId, store, { excludeSessionId: session.id })
  const history = applyBaseline(all, session.location, session.baselineAnswers?.[exerciseId] === 'new')
  const deloads = await getDeloads(store)
  return suggest({ exercise: engineExercise(ex, entry), history, unit, now, location: session.location, deloads })
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

const DAY = 24 * 60 * 60 * 1000

export interface DeloadWindow {
  from: number
  until: number
}

export const getDeloads = (store = db) => getSetting<DeloadWindow[]>('deloads', [], store)

export function activeDeload(deloads: DeloadWindow[], now: number): DeloadWindow | undefined {
  return deloads.find((d) => now >= d.from && now <= d.until)
}

/** Accepting a deload starts a one-week window: 90% loads, half the sets. */
export async function acceptDeload(store = db, now = Date.now()) {
  const deloads = await getDeloads(store)
  await setSetting('deloads', [...deloads, { from: now, until: now + CFG.deload.days * DAY }], store)
}

export async function dismissDeload(store = db, now = Date.now()) {
  await setSetting('deloadSnoozeUntil', now + CFG.deload.snoozeDays * DAY, store)
}

/** The reactive deload suggestion, if one is due: not during a deload and not snoozed. */
export async function pendingDeloadAdvice(unit: Unit, store = db, now = Date.now()): Promise<DeloadAdvice | undefined> {
  if (activeDeload(await getDeloads(store), now)) return undefined
  if ((await getSetting<number>('deloadSnoozeUntil', 0, store)) > now) return undefined
  const deloads = await getDeloads(store)
  const candidates: DeloadCandidate[] = []
  for (const ex of await store.exercises.toArray()) {
    const history = (await exerciseHistory(ex.id!, store)).filter((h) => !deloads.some((d) => h.startedAt >= d.from && h.startedAt <= d.until))
    const eng = engineExercise(ex)
    const exposures = toExposures(history, eng, unit)
    if (exposures.length <= CFG.calibrationExposures) continue
    const lastDeloadEnd = Math.max(-Infinity, ...deloads.filter((d) => d.until < now).map((d) => d.until))
    const a = analyze(eng, exposures, unit, lastDeloadEnd)
    candidates.push({
      exerciseId: ex.id!,
      name: ex.name,
      muscle: ex.muscle,
      stalls: a.counted.map((e) => e.session.startedAt),
      exposures: exposures
        .filter((e) => !hasConfounder(e.session.chips))
        .map((e) => ({ startedAt: e.session.startedAt, weight: e.weight, avgReps: e.reps.reduce((x, y) => x + y, 0) / e.reps.length })),
    })
  }
  return detectDeload(candidates, now)
}

export interface Brief {
  deload?: { active?: DeloadWindow; advice?: DeloadAdvice }
  lastSessions: Session[]
  items: { exerciseId: number; suggestion: Suggestion }[]
  flags: PainFlag[]
}

/** Last 1-2 Sessions of this type, today's Suggestions, and open Pain flags that apply. */
export async function buildBrief(session: Session, unit: Unit, store = db, now = session.startedAt): Promise<Brief> {
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
  const active = activeDeload(await getDeloads(store), now)
  const advice = active ? undefined : await pendingDeloadAdvice(unit, store, now)
  return { lastSessions, items, flags, deload: active || advice ? { active, advice } : undefined }
}
