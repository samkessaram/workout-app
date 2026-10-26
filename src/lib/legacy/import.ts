import { db, type Exercise, type Routine, type Session, type SessionSet, type SessionType, type Unit } from '../db'
import { CONFOUNDER_CHIPS } from '../chips'
import { listExercises, saveExercise } from '../exercises'
import { entryFor } from '../routines'
import { SESSION_TYPES, workingSets } from '../sessions'
import { itemId, nameKey } from './map'
import type { LegacySession } from './parse'

export type Resolution =
  | { kind: 'map'; exerciseId: number }
  | { kind: 'create'; exercise: Exercise }
  | { kind: 'skip' }

export interface ImportResult {
  imported: number
  duplicates: number
  created: number
  skippedExercises: number
}

const CONFOUNDER_PATTERNS: [string, RegExp][] = [
  ['poor sleep', /\b(poor|bad|little|no|terrible) sleep\b|\bslept (badly|poorly)\b|\bbarely slept\b/i],
  ['ill', /\b(ill|sick|flu|fever|cold)\b/i],
  ['travel', /\b(travel(l?ed|l?ing)?|trip|flight|jet ?lag)\b/i],
  ['missed food', /\b(missed|skipped) (a )?(meal|food|breakfast|lunch)\b|\bdidn'?t eat\b/i],
  ['injury', /\binjur(y|ed)\b/i],
]

/** Confounder chips implied by a free-text legacy note. Conservative: only clear phrases match. */
export function confoundersIn(text: string | undefined): string[] {
  if (!text) return []
  return CONFOUNDER_PATTERNS.filter(([chip, re]) => CONFOUNDER_CHIPS.includes(chip) && re.test(text)).map(([chip]) => chip)
}

function startOf(date: string, offset: number): number {
  return new Date(`${date}T12:00:00`).getTime() + offset * 60_000
}

export async function importLegacy(
  sessions: LegacySession[],
  resolutions: Record<string, Resolution>,
  store = db,
  unit: Unit = 'lb',
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, duplicates: 0, created: 0, skippedExercises: 0 }
  const ids = new Map<string, number | null>()

  for (const [key, res] of Object.entries(resolutions)) {
    if (res.kind === 'skip') ids.set(key, null)
    else if (res.kind === 'map') ids.set(key, res.exerciseId)
    else {
      const existing = (await listExercises(store)).find(
        (e) => nameKey(e.name) === nameKey(res.exercise.name) && e.equipment === res.exercise.equipment,
      )
      if (existing) ids.set(key, existing.id!)
      else {
        ids.set(key, await saveExercise(res.exercise, store))
        result.created++
      }
    }
  }

  const known = new Set((await store.sessions.toArray()).map((s) => s.legacyKey).filter(Boolean))
  const perDay = new Map<string, number>()

  for (const legacy of sessions) {
    if (known.has(legacy.key)) {
      result.duplicates++
      continue
    }
    const n = perDay.get(legacy.date) ?? 0
    perDay.set(legacy.date, n + 1)
    const startedAt = startOf(legacy.date, n)

    const exerciseIds: number[] = []
    const sets: SessionSet[] = []
    const exerciseChips: Record<number, string[]> = {}
    const exerciseNotes: Record<number, string> = {}
    const sessionConfounders = confoundersIn(legacy.notes)

    for (const e of legacy.exercises) {
      const id = ids.get(itemId(e.name, e.equipment))
      if (id === undefined || id === null) {
        result.skippedExercises++
        continue
      }
      if (!exerciseIds.includes(id)) exerciseIds.push(id)
      const chips = [...new Set([...sessionConfounders, ...confoundersIn(e.note)])]
      if (chips.length) exerciseChips[id] = [...new Set([...(exerciseChips[id] ?? []), ...chips])]
      if (e.note) exerciseNotes[id] = [exerciseNotes[id], e.note].filter(Boolean).join('; ')
      for (const s of e.sets) {
        const setChips = confoundersIn(s.note)
        sets.push({
          id: crypto.randomUUID(),
          exerciseId: id,
          weight: s.weight,
          unit: s.unit,
          reps: s.reps,
          warmup: s.warmup,
          at: startedAt + sets.length,
          ...(setChips.length ? { chips: setChips } : {}),
          ...(s.note ? { note: s.note } : {}),
        })
      }
    }
    if (sets.length === 0) continue

    const session: Session = {
      date: legacy.date,
      type: legacy.type,
      location: legacy.location,
      trainer: legacy.trainer,
      timer: false,
      startedAt,
      closedAt: startedAt + sets.length,
      exerciseIds,
      sets,
      legacyKey: legacy.key,
      ...(Object.keys(exerciseChips).length ? { exerciseChips } : {}),
      ...(Object.keys(exerciseNotes).length ? { exerciseNotes } : {}),
    }
    await store.sessions.add(session)
    result.imported++
  }
  void unit
  return result
}

/**
 * Seeds a Routine for each Session type that has none, from the latest Session of that type:
 * its Exercises in order, with the number of working Sets done as the target.
 */
export async function seedRoutines(store = db): Promise<SessionType[]> {
  const seeded: SessionType[] = []
  const sessions = await store.sessions.toArray()
  const exercises = await store.exercises.toArray()
  for (const type of SESSION_TYPES) {
    if (await store.routines.where('sessionType').equals(type).count()) continue
    const latest = sessions.filter((s) => s.type === type && s.sets.length).sort((a, b) => b.startedAt - a.startedAt)[0]
    if (!latest) continue
    const entries = latest.exerciseIds
      .map((id) => {
        const ex = exercises.find((e) => e.id === id)
        if (!ex) return undefined
        const done = workingSets(latest.sets.filter((s) => s.exerciseId === id)).length
        return entryFor(ex, Math.min(6, Math.max(1, done || 3)))
      })
      .filter((e): e is NonNullable<typeof e> => !!e)
    if (!entries.length) continue
    const routine: Routine = { sessionType: type, entries }
    await store.routines.add(routine)
    seeded.push(type)
  }
  return seeded
}
