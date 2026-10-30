import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { WorkoutDB } from './db'
import { deleteExercise, exerciseSessionCount, KIND_DEFAULTS, listExercises, newExercise, saveExercise } from './exercises'
import { entryFor, saveRoutine } from './routines'
import { raiseFlag } from './pain'
import { addExerciseToSession, addSet, startSession } from './sessions'

describe('exercise library', () => {
  it('keeps same-named Exercises with different equipment distinct', async () => {
    const store = new WorkoutDB('ex-distinct')
    const a = { ...newExercise('lb'), name: 'Lateral Raise', equipment: 'dumbbell' as const }
    const b = { ...newExercise('lb'), name: 'Lateral Raise', equipment: 'cable' as const }
    await saveExercise(a, store)
    await saveExercise(b, store)
    expect(await listExercises(store)).toHaveLength(2)
  })

  it('rejects a duplicate name plus equipment, ignoring case', async () => {
    const store = new WorkoutDB('ex-dupe')
    await saveExercise({ ...newExercise('lb'), name: 'Leg Press', equipment: 'machine' }, store)
    await expect(
      saveExercise({ ...newExercise('lb'), name: 'leg press', equipment: 'machine' }, store),
    ).rejects.toThrow(/already exists/)
  })

  it('allows editing an Exercise without clashing with itself', async () => {
    const store = new WorkoutDB('ex-edit')
    const id = await saveExercise({ ...newExercise('lb'), name: 'Curl', equipment: 'dumbbell' }, store)
    const row = (await store.exercises.get(id))!
    await expect(saveExercise({ ...row, step: 2.5 }, store)).resolves.toBe(id)
  })

  it('rejects an empty name and an inverted rep range', async () => {
    const store = new WorkoutDB('ex-invalid')
    await expect(saveExercise(newExercise('lb'), store)).rejects.toThrow()
    await expect(
      saveExercise({ ...newExercise('lb'), name: 'X', repMin: 12, repMax: 8 }, store),
    ).rejects.toThrow()
  })

  it('has the spec defaults per kind', () => {
    expect(KIND_DEFAULTS['compound-lower']).toMatchObject({ repMin: 6, repMax: 10, rest: 'heavy' })
    expect(KIND_DEFAULTS.machine).toMatchObject({ repMin: 8, repMax: 12, rest: 'moderate' })
    expect(KIND_DEFAULTS.isolation).toMatchObject({ repMin: 10, repMax: 15, rest: 'isolation' })
  })

  describe('deleting', () => {
    const lb = { unit: 'lb' as const, warmup: false }

    it('removes an unused Exercise and every trace of it, leaving the rest alone', async () => {
      const store = new WorkoutDB('ex-delete')
      const gone = await saveExercise({ ...newExercise('lb'), name: 'Gone' }, store)
      const kept = await saveExercise({ ...newExercise('lb'), name: 'Kept' }, store)
      const goneEx = (await store.exercises.get(gone))!
      const keptEx = (await store.exercises.get(kept))!
      const routine = await saveRoutine({ sessionType: 'lower', name: 'A', entries: [entryFor(goneEx), entryFor(keptEx)] }, store)
      const sid = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: false, routineId: routine }, store)
      await raiseFlag({ exerciseId: gone, severity: 'dull', action: 'continue' }, store)
      await store.suggestionLog.add({ sessionId: sid, exerciseId: gone, stage: 'CALIBRATION', rule: 'x', suggested: {} })

      expect(await exerciseSessionCount(gone, store)).toBe(0)
      await deleteExercise(gone, store)

      expect(await store.exercises.get(gone)).toBeUndefined()
      expect((await store.routines.get(routine))!.entries.map((e) => e.exerciseId)).toEqual([kept])
      expect((await store.sessions.get(sid))!.exerciseIds).toEqual([kept])
      expect(await store.painFlags.count()).toBe(0)
      expect(await store.suggestionLog.count()).toBe(0)
      expect(await store.exercises.get(kept)).toBeDefined()
    })

    it('refuses to delete an Exercise with logged Sets, so history is never lost', async () => {
      const store = new WorkoutDB('ex-delete-used')
      const id = await saveExercise({ ...newExercise('lb'), name: 'Used' }, store)
      const a = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: false }, store)
      await addExerciseToSession(a, id, store)
      await addSet(a, { exerciseId: id, weight: 100, reps: 8, ...lb }, store)
      expect(await exerciseSessionCount(id, store)).toBe(1)
      await expect(deleteExercise(id, store)).rejects.toThrow(/logged Sets/)
      expect(await store.exercises.get(id)).toBeDefined()
    })
  })
})
