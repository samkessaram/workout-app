import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { WorkoutDB } from './db'
import { EQUIPMENT, JOINTS, KIND_DEFAULTS, MUSCLES, newExercise, saveExercise } from './exercises'
import { SEED_EXERCISES, seedExercises } from './exerciseSeed'
import { getSetting } from './settings.svelte'

describe('built-in Exercise library', () => {
  it('only uses known equipment, kinds, muscles and joints, with no duplicates', () => {
    const keys = SEED_EXERCISES.map((e) => `${e.name}|${e.equipment}`.toLowerCase())
    expect(new Set(keys).size).toBe(keys.length)
    for (const e of SEED_EXERCISES) {
      expect(EQUIPMENT).toContain(e.equipment)
      expect(Object.keys(KIND_DEFAULTS)).toContain(e.kind)
      if (e.muscle) expect(MUSCLES).toContain(e.muscle)
      for (const j of e.joints) expect(JOINTS).toContain(j)
    }
    expect(SEED_EXERCISES.length).toBeGreaterThan(30)
  })

  it('adds the library once, with the kind defaults and a unit-appropriate jump', async () => {
    const store = new WorkoutDB('seed-once')
    expect(await seedExercises('lb', store)).toBe(SEED_EXERCISES.length)
    const squat = (await store.exercises.where('name').equals('Barbell Squat').first())!
    expect(squat).toMatchObject({ equipment: 'barbell', kind: 'compound-lower', stepUnit: 'lb', step: 5, restCategory: 'heavy' })
    expect(squat.repMin).toBe(KIND_DEFAULTS['compound-lower'].repMin)
    expect(squat.startWeight).toBeUndefined() // personal, so the lifter sets it
    expect(await seedExercises('lb', store)).toBe(0)
    expect(await store.exercises.count()).toBe(SEED_EXERCISES.length)
  })

  it('does not bring back an Exercise the lifter deleted', async () => {
    const store = new WorkoutDB('seed-deleted')
    await seedExercises('lb', store)
    const squat = (await store.exercises.where('name').equals('Barbell Squat').first())!
    await store.exercises.delete(squat.id!)
    await seedExercises('lb', store)
    expect(await store.exercises.where('name').equals('Barbell Squat').count()).toBe(0)
  })

  it('leaves the lifter\'s own Exercises alone, even one with the same name', async () => {
    const store = new WorkoutDB('seed-existing')
    await saveExercise({ ...newExercise('lb'), name: 'barbell squat', equipment: 'barbell', step: 10, startWeight: 135 }, store)
    await seedExercises('lb', store)
    const mine = await store.exercises.where('name').equalsIgnoreCase('barbell squat').toArray()
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ step: 10, startWeight: 135 })
    expect(await store.exercises.count()).toBe(SEED_EXERCISES.length)
  })

  it('uses kilogram jumps for a kg lifter and records that it ran', async () => {
    const store = new WorkoutDB('seed-kg')
    await seedExercises('kg', store)
    expect((await store.exercises.toArray()).filter((e) => e.stepUnit !== 'kg')).toEqual([])
    expect(await getSetting('exerciseSeedVersion', 0, store)).toBeGreaterThan(0)
  })
})
