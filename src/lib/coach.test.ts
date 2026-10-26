import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { acceptDeload, activeDeload, buildBrief, dismissDeload, getDeloads, logSuggestion, pendingDeloadAdvice, recordActual, suggestionFor } from './coach'
import { WorkoutDB } from './db'
import { getSetting } from './settings.svelte'
import { newExercise, saveExercise } from './exercises'
import { raiseFlag } from './pain'
import { entryFor, saveRoutine } from './routines'
import { needsBaselineQuestion } from './history'
import { addSet, answerBaseline, closeSession, startSession } from './sessions'

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

describe('per-Location Baseline', () => {
  const at = (location: string) => async (store: WorkoutDB, exId: number, sets: [number, number][], when: number) => {
    const sid = await startSession({ ...base, type: 'lower', location }, store, when)
    for (const [weight, reps] of sets) await addSet(sid, { exerciseId: exId, weight, unit: 'lb', reps, warmup: false }, store, when)
    await closeSession(sid, store, when)
    return sid
  }

  it('shares history across Locations by default', async () => {
    const { store, exId } = await setup('bl-shared')
    for (let i = 1; i <= 3; i++) await at('gym')(store, exId, [[100, 12], [100, 12], [100, 12]], i * 1000)
    const sid = await startSession({ ...base, type: 'lower', location: 'home' }, store, 9000)
    const s = await suggestionFor(exId, (await store.sessions.get(sid))!, 'lb', store)
    expect(s?.weight).toBe(105)
  })

  it('splits the Baseline only at a Location where the lifter said it feels different', async () => {
    const { store, exId } = await setup('bl-split')
    for (let i = 1; i <= 3; i++) await at('gym')(store, exId, [[100, 12], [100, 12], [100, 12]], i * 1000)
    // first session at the new gym: 60 lb, answered "feels different"
    const first = await at('new gym')(store, exId, [[60, 12], [60, 12], [60, 12]], 4000)
    await store.sessions.update(first, { baselineAnswers: { [exId]: 'new' } })

    const here = await startSession({ ...base, type: 'lower', location: 'new gym' }, store, 9000)
    const atNew = await suggestionFor(exId, (await store.sessions.get(here))!, 'lb', store)
    expect(atNew).toMatchObject({ rule: 'calibration', weight: 60 }) // only the new gym's own history

    const old = await startSession({ ...base, type: 'lower', location: 'gym' }, store, 9500)
    const atOld = await suggestionFor(exId, (await store.sessions.get(old))!, 'lb', store)
    expect(atOld?.weight).toBe(105) // the old gym ignores the new gym's lighter machine
  })

  it('applies a "feels different" answer straight away, within the same Session', async () => {
    const { store, exId } = await setup('bl-now')
    for (let i = 1; i <= 3; i++) await at('gym')(store, exId, [[100, 12], [100, 12], [100, 12]], i * 1000)
    const sid = await startSession({ ...base, type: 'lower', location: 'new gym' }, store, 9000)
    await answerBaseline(sid, exId, 'new', store)
    const s = await suggestionFor(exId, (await store.sessions.get(sid))!, 'lb', store)
    expect(s).toMatchObject({ rule: 'no-history', weight: null })
  })

  it('asks once: first time at a Location, 15%+ off the Suggestion, not already answered', () => {
    const past = [{ sessionId: 1, date: '', startedAt: 1, location: 'gym', trainer: false, sets: [], chips: [] }]
    const args = { history: past, location: 'new gym', suggestedWeight: 100, firstSetWeight: 80, alreadyAnswered: false, threshold: 0.15 }
    expect(needsBaselineQuestion(args)).toBe(true)
    expect(needsBaselineQuestion({ ...args, firstSetWeight: 90 })).toBe(false) // 10% off
    expect(needsBaselineQuestion({ ...args, firstSetWeight: 85 })).toBe(true) // exactly 15%
    expect(needsBaselineQuestion({ ...args, firstSetWeight: 120 })).toBe(true) // above counts too
    expect(needsBaselineQuestion({ ...args, alreadyAnswered: true })).toBe(false)
    expect(needsBaselineQuestion({ ...args, suggestedWeight: null })).toBe(false)
    expect(needsBaselineQuestion({ ...args, location: 'gym' })).toBe(false) // done here before
  })
})

describe('deload state', () => {
  async function stalledChest(store: WorkoutDB, now: number) {
    const ids: number[] = []
    for (const name of ['Bench', 'Fly', 'Dip']) {
      const id = await saveExercise({ ...newExercise('lb'), name, kind: 'machine', repMin: 8, repMax: 12, muscle: 'chest' }, store)
      ids.push(id)
      for (let i = 0; i < 5; i++) await lifted(store, id, 'upper', [[100, 10], [100, 10], [100, 10]], now - (40 - i * 8) * 86_400_000)
    }
    return ids
  }

  it('suggests a deload when 3 exercises for one muscle stall, and a dismissal snoozes it', async () => {
    const store = new WorkoutDB('dl-advice')
    const now = 1_800_000_000_000
    await stalledChest(store, now)
    const advice = await pendingDeloadAdvice('lb', store, now)
    expect(advice).toMatchObject({ kind: 'stalls', muscle: 'chest' })
    await dismissDeload(store, now)
    expect(await pendingDeloadAdvice('lb', store, now + 86_400_000)).toBeUndefined()
    // the snooze lasts 14 days from the dismissal
    expect(await getSetting('deloadSnoozeUntil', 0, store)).toBe(now + 14 * 86_400_000)
  })

  it('accepting starts a one-week window that lowers Suggestions to 90%', async () => {
    const store = new WorkoutDB('dl-accept')
    const now = 1_800_000_000_000
    const [bench] = await stalledChest(store, now)
    await acceptDeload(store, now)
    expect(await pendingDeloadAdvice('lb', store, now)).toBeUndefined()
    const sid = await startSession({ ...base, type: 'upper' }, store, now)
    const s = await suggestionFor(bench, (await store.sessions.get(sid))!, 'lb', store)
    expect(s?.rule).toBe('deload')
    expect(s!.weight!).toBeLessThanOrEqual(95)
    const [w] = await getDeloads(store)
    expect(activeDeload([w], now + 3 * 86_400_000)).toBeDefined()
    expect(activeDeload([w], now + 8 * 86_400_000)).toBeUndefined()
  })
})
