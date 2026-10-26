import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { WorkoutDB } from './db'
import { KIND_DEFAULTS, listExercises, newExercise, saveExercise } from './exercises'

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
})
