import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { WorkoutDB, type Session } from './db'
import { newExercise, saveExercise } from './exercises'
import { flagsRelevantTo, openFlags, raiseFlag, resolveFlag, stoppedInSession } from './pain'

describe('pain flags', () => {
  it('stays open across Sessions until resolved', async () => {
    const store = new WorkoutDB('p-open')
    const id = await raiseFlag({ exerciseId: 1, severity: 'dull', action: 'continue', bodyArea: 'shoulder' }, store, 1000)
    expect(await openFlags(new WorkoutDB('p-open'))).toHaveLength(1)
    await resolveFlag(id, store, 2000)
    expect(await openFlags(store)).toHaveLength(0)
    expect((await store.painFlags.get(id))!.resolvedAt).toBe(2000)
  })

  it('shows on Exercises that share the body area, and on the flagged Exercise itself', async () => {
    const store = new WorkoutDB('p-share')
    const press = await saveExercise({ ...newExercise('lb'), name: 'Overhead Press', muscle: 'shoulders', bodyAreas: ['shoulder', 'elbow'] }, store)
    const raise = await saveExercise({ ...newExercise('lb'), name: 'Lateral Raise', equipment: 'dumbbell', kind: 'isolation', muscle: 'shoulders', bodyAreas: ['shoulder'] }, store)
    const curl = await saveExercise({ ...newExercise('lb'), name: 'Curl', equipment: 'dumbbell', muscle: 'biceps', bodyAreas: ['elbow'] }, store)
    const squat = await saveExercise({ ...newExercise('lb'), name: 'Squat', muscle: 'quads', bodyAreas: ['knee'] }, store)
    const noArea = await saveExercise({ ...newExercise('lb'), name: 'Mystery' }, store)
    await raiseFlag({ exerciseId: press, severity: 'sharp', action: 'stop', bodyArea: 'shoulder' }, store)
    await raiseFlag({ exerciseId: noArea, severity: 'dull', action: 'continue' }, store)
    const flags = await openFlags(store)
    const ex = async (id: number) => (await store.exercises.get(id))!
    expect(flagsRelevantTo(await ex(press), flags)).toHaveLength(1)
    expect(flagsRelevantTo(await ex(raise), flags)).toHaveLength(1)
    expect(flagsRelevantTo(await ex(curl), flags)).toHaveLength(0)
    expect(flagsRelevantTo(await ex(squat), flags)).toHaveLength(0)
    // a flag without an area only applies to its own Exercise
    expect(flagsRelevantTo(await ex(noArea), flags)).toHaveLength(1)
    expect(flagsRelevantTo(await ex(squat), flags)).toHaveLength(0)
  })

  it('marks a movement stopped only for a sharp stop raised this Session', () => {
    const session = { startedAt: 5000 } as Session
    const flag = (over: object) => ({ id: 1, exerciseId: 1, severity: 'sharp' as const, action: 'stop' as const, createdAt: 6000, ...over })
    expect(stoppedInSession(1, session, [flag({})])).toBe(true)
    expect(stoppedInSession(1, session, [flag({ severity: 'dull' })])).toBe(false)
    expect(stoppedInSession(1, session, [flag({ action: 'continue' })])).toBe(false)
    expect(stoppedInSession(1, session, [flag({ createdAt: 1000 })])).toBe(false)
    expect(stoppedInSession(2, session, [flag({})])).toBe(false)
  })
})
