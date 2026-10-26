import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { WorkoutDB } from './db'
import { newExercise, saveExercise } from './exercises'
import { applyDiff, entryFor, getRoutine, moveEntry, routineDiff, saveRoutine } from './routines'
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
  it('saves one Routine per Session type and a new Session loads it in order', async () => {
    const store = new WorkoutDB('r-load')
    const { ids, exercises } = await seed(store)
    await saveRoutine({ sessionType: 'lower', entries: [ids[2], ids[0]].map((id) => entryFor(exercises.find((e) => e.id === id)!)) }, store)
    await saveRoutine({ sessionType: 'lower', entries: [entryFor(exercises[1])] }, store)
    expect(await store.routines.count()).toBe(1)
    await saveRoutine({ sessionType: 'lower', entries: [ids[2], ids[0]].map((id) => entryFor(exercises.find((e) => e.id === id)!)) }, store)
    const sid = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: true }, store)
    expect((await store.sessions.get(sid))!.exerciseIds).toEqual([ids[2], ids[0]])
    const upper = await startSession({ type: 'upper', location: 'gym', trainer: false, timer: true }, store)
    expect((await store.sessions.get(upper))!.exerciseIds).toEqual([])
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
    const diff = routineDiff((await getRoutine('lower', store))!, session)
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
