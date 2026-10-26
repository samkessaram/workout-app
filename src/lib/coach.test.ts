import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { buildBrief, logSuggestion, recordActual, suggestionFor } from './coach'
import { WorkoutDB } from './db'
import { newExercise, saveExercise } from './exercises'
import { raiseFlag } from './pain'
import { entryFor, saveRoutine } from './routines'
import { addSet, closeSession, startSession } from './sessions'

const base = { location: 'gym', trainer: false, timer: true }

async function lifted(store: WorkoutDB, exId: number, type: 'lower' | 'upper', sets: [number, number][], at: number) {
  const sid = await startSession({ ...base, type }, store, at)
  for (const [weight, reps] of sets) await addSet(sid, { exerciseId: exId, weight, unit: 'lb', reps, warmup: false }, store, at)
  await closeSession(sid, store, at)
  return sid
}

async function setup(name: string) {
  const store = new WorkoutDB(name)
  const exId = await saveExercise({ ...newExercise('lb'), name: 'Leg Press', equipment: 'machine', kind: 'machine', repMin: 8, repMax: 12, muscle: 'quads', bodyAreas: ['knee'] }, store)
  return { store, exId }
}

describe('coach', () => {
  it('suggests from history, excluding the open Session', async () => {
    const { store, exId } = await setup('co-history')
    for (let i = 1; i <= 3; i++) await lifted(store, exId, 'lower', [[100, 12], [100, 12], [100, 12]], i * 1000)
    const open = await startSession({ ...base, type: 'lower' }, store, 9000)
    await addSet(open, { exerciseId: exId, weight: 999, unit: 'lb', reps: 1, warmup: false }, store, 9000)
    const s = await suggestionFor(exId, (await store.sessions.get(open))!, 'lb', store)
    expect(s).toMatchObject({ weight: 105, reps: 8, rule: 'dp-increase' })
  })

  it('uses the Routine target sets and rep range for the Exercise', async () => {
    const { store, exId } = await setup('co-routine')
    const ex = (await store.exercises.get(exId))!
    await saveRoutine({ sessionType: 'lower', entries: [{ ...entryFor(ex, 3), repMax: 10 }] }, store)
    for (let i = 1; i <= 3; i++) await lifted(store, exId, 'lower', [[100, 10], [100, 10], [100, 10]], i * 1000)
    await lifted(store, exId, 'lower', [[100, 10]], 5000) // partial: 1 of 3 sets
    const open = await startSession({ ...base, type: 'lower' }, store, 9000)
    const s = await suggestionFor(exId, (await store.sessions.get(open))!, 'lb', store)
    expect(s).toMatchObject({ weight: 105, reps: 8, rule: 'dp-increase' })
  })

  it('logs a Suggestion once per Session and records what was actually lifted', async () => {
    const { store, exId } = await setup('co-log')
    const sid = await startSession({ ...base, type: 'lower' }, store, 1000)
    const s = (await suggestionFor(exId, (await store.sessions.get(sid))!, 'lb', store))!
    const a = await logSuggestion(sid, exId, s, store)
    const b = await logSuggestion(sid, exId, s, store)
    expect(a).toBe(b)
    await addSet(sid, { exerciseId: exId, weight: 120, unit: 'lb', reps: 10, warmup: false }, store)
    await addSet(sid, { exerciseId: exId, weight: 50, unit: 'lb', reps: 10, warmup: true }, store)
    await recordActual(sid, exId, store)
    const [entry] = await store.suggestionLog.toArray()
    expect(entry).toMatchObject({ sessionId: sid, exerciseId: exId, rule: 'no-history', stage: 'CALIBRATION' })
    expect(entry.actual).toEqual([{ weight: 120, unit: 'lb', reps: 10 }])
  })

  it('builds a Brief: last 2 Sessions of the type, Suggestions, relevant open Pain flags', async () => {
    const { store, exId } = await setup('co-brief')
    const squat = await saveExercise({ ...newExercise('lb'), name: 'Squat', muscle: 'quads', bodyAreas: ['knee'] }, store)
    const curl = await saveExercise({ ...newExercise('lb'), name: 'Curl', equipment: 'dumbbell', muscle: 'biceps', bodyAreas: ['elbow'] }, store)
    await lifted(store, exId, 'lower', [[100, 10]], 1000)
    await lifted(store, exId, 'lower', [[100, 11]], 2000)
    await lifted(store, exId, 'lower', [[100, 12]], 3000)
    await lifted(store, curl, 'upper', [[40, 10]], 4000)
    await raiseFlag({ exerciseId: squat, severity: 'dull', action: 'continue', bodyArea: 'knee' }, store)
    await raiseFlag({ exerciseId: curl, severity: 'dull', action: 'continue', bodyArea: 'elbow' }, store)
    const sid = await startSession({ ...base, type: 'lower', exerciseIds: [exId] }, store, 9000)
    const brief = await buildBrief((await store.sessions.get(sid))!, 'lb', store)
    expect(brief.lastSessions.map((s) => s.startedAt)).toEqual([3000, 2000])
    expect(brief.items).toHaveLength(1)
    expect(brief.items[0].suggestion).toMatchObject({ weight: 105, rule: 'dp-increase' })
    expect(brief.flags.map((f) => f.exerciseId)).toEqual([squat])
  })
})
