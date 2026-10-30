import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { WorkoutDB } from './db'
import { newExercise, saveExercise } from './exercises'
import {
  applyDiff, deleteRoutine, entryFor, getRoutine, listRoutines, moveEntry, nextRoutine, routineDiff, routineForSession, routineLabel, saveRoutine,
} from './routines'
import { addSet, startSession } from './sessions'

const set = (exerciseId: number) => ({ exerciseId, weight: 100, unit: 'lb' as const, reps: 8, warmup: false })

async function seed(store: WorkoutDB) {
  const ids: number[] = []
  for (const name of ['A', 'B', 'C', 'D']) {
    ids.push(await saveExercise({ ...newExercise('lb'), name }, store))
  }
  const exercises = await store.exercises.toArray()
  return { ids, exercises }
}

describe('routines', () => {
  it('keeps several named Routines per Session type and a new Session loads the chosen one', async () => {
    const store = new WorkoutDB('r-load')
    const { ids, exercises } = await seed(store)
    const of = (...picks: number[]) => picks.map((id) => entryFor(exercises.find((e) => e.id === id)!))
    const a = await saveRoutine({ sessionType: 'lower', name: 'Lower A', entries: of(ids[2], ids[0]) }, store)
    const b = await saveRoutine({ sessionType: 'lower', name: 'Lower B', entries: of(ids[1]) }, store)
    await saveRoutine({ sessionType: 'upper', name: 'Upper A', entries: of(ids[3]) }, store)
    expect((await listRoutines('lower', store)).map((r) => r.name)).toEqual(['Lower A', 'Lower B'])
    const base = { type: 'lower' as const, location: 'gym', trainer: false, timer: true }
    const sid = await startSession({ ...base, routineId: a }, store)
    expect(await store.sessions.get(sid)).toMatchObject({ routineId: a, exerciseIds: [ids[2], ids[0]] })
    const other = await startSession({ ...base, routineId: b }, store)
    expect((await store.sessions.get(other))!.exerciseIds).toEqual([ids[1]])
    const none = await startSession({ ...base, type: 'other' }, store)
    expect((await store.sessions.get(none))!.exerciseIds).toEqual([])
  })

  it('offers the Routine done longest ago next, so a rotation advances', async () => {
    const store = new WorkoutDB('r-rotate')
    const { ids, exercises } = await seed(store)
    const entries = [entryFor(exercises.find((e) => e.id === ids[0])!)]
    const a = await saveRoutine({ sessionType: 'upper', name: 'Upper A', entries }, store)
    const b = await saveRoutine({ sessionType: 'upper', name: 'Upper B', entries }, store)
    const base = { type: 'upper' as const, location: 'gym', trainer: false, timer: false }
    expect((await nextRoutine('upper', store))!.id).toBe(a)
    await startSession({ ...base, routineId: a }, store, 1000)
    expect((await nextRoutine('upper', store))!.id).toBe(b)
    await startSession({ ...base, routineId: b }, store, 2000)
    expect((await nextRoutine('upper', store))!.id).toBe(a)
    expect(await nextRoutine('lower', store)).toBeUndefined()
    const sid = await startSession(base, store, 3000) // no choice made: starts from the next in rotation
    expect((await store.sessions.get(sid))!.routineId).toBe(a)
  })

  it('labels unnamed Routines by Session type, and renames and deletes', async () => {
    const store = new WorkoutDB('r-name')
    expect(routineLabel({ sessionType: 'lower' })).toBe('Lower')
    expect(routineLabel({ sessionType: 'lower', name: '  Lower B ' })).toBe('Lower B')
    const id = await saveRoutine({ sessionType: 'lower', name: 'Legs', entries: [] }, store)
    await saveRoutine({ ...(await store.routines.get(id))!, name: 'Heavy legs' }, store)
    expect(await store.routines.count()).toBe(1)
    expect((await getRoutine(id, store))!.name).toBe('Heavy legs')
    await deleteRoutine(id, store)
    expect(await getRoutine(id, store)).toBeUndefined()
  })

  it('resolves a Session to its own Routine, falling back by type only for older Sessions', async () => {
    const store = new WorkoutDB('r-resolve')
    const a = await saveRoutine({ sessionType: 'lower', name: 'A', entries: [] }, store)
    const b = await saveRoutine({ sessionType: 'lower', name: 'B', entries: [] }, store)
    const base = { type: 'lower' as const, location: 'gym', trainer: false, timer: false }
    const sid = await startSession({ ...base, routineId: b }, store)
    expect((await routineForSession((await store.sessions.get(sid))!, store))!.id).toBe(b)
    const legacy = { ...(await store.sessions.get(sid))!, routineId: undefined }
    expect((await routineForSession(legacy, store))!.id).toBe(a)
    await deleteRoutine(b, store)
    expect(await routineForSession((await store.sessions.get(sid))!, store)).toBeUndefined()
  })

  it('reorders entries and ignores moves off the ends', () => {
    const e = [1, 2, 3].map((exerciseId) => ({ exerciseId, targetSets: 3, repMin: 6, repMax: 10, restCategory: 'heavy' as const }))
    expect(moveEntry(e, 2, -1).map((x) => x.exerciseId)).toEqual([1, 3, 2])
    expect(moveEntry(e, 0, -1)).toBe(e)
    expect(moveEntry(e, 2, 1)).toBe(e)
  })

  it('finds skipped and added Exercises and applies them to the Routine', async () => {
    const store = new WorkoutDB('r-diff')
    const { ids, exercises } = await seed(store)
    const routine = { sessionType: 'lower' as const, entries: [ids[0], ids[1], ids[2]].map((id) => entryFor(exercises.find((e) => e.id === id)!)) }
    await saveRoutine(routine, store)
    const sid = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: true }, store)
    await addSet(sid, set(ids[0]), store)
    await addSet(sid, set(ids[3]), store)
    const session = (await store.sessions.get(sid))!
    const diff = routineDiff((await routineForSession(session, store))!, session)
    expect(diff).toEqual({ added: [ids[3]], skipped: [ids[1], ids[2]] })
    const next = applyDiff(routine, diff, exercises)
    expect(next.entries.map((e) => e.exerciseId)).toEqual([ids[0], ids[3]])
  })

  it('reports no difference when the Session followed the Routine', async () => {
    const store = new WorkoutDB('r-same')
    const { ids, exercises } = await seed(store)
    const routine = { sessionType: 'lower' as const, entries: [entryFor(exercises.find((e) => e.id === ids[0])!)] }
    await saveRoutine(routine, store)
    const sid = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: true }, store)
    await addSet(sid, set(ids[0]), store)
    expect(routineDiff(routine, (await store.sessions.get(sid))!)).toEqual({ added: [], skipped: [] })
  })
})
