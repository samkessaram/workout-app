import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { WorkoutDB } from '../db'
import { newExercise, saveExercise } from '../exercises'
import { confoundersIn, importLegacy, seedRoutines, type Resolution } from './import'
import { draftExercise, guessKind, itemId, planImport } from './map'
import { parseLegacy } from './parse'

const record = (date: string, type: string, exercises: unknown[], extra: object = {}) =>
  ({ name: `${date}-${type}.json`, text: JSON.stringify({ date, type, location: 'gym', exercises, ...extra }) })

const press = { name: 'Leg Press', equipment: 'machine', sets: [{ weight: 180, reps: 10 }, { weight: 180, reps: 9 }] }
const curl = { name: 'DB Curl', equipment: 'dumbbell', sets: [{ weight_kg: 10, reps: 12, note: 'felt heavy' }] }

describe('plan', () => {
  it('matches an existing Exercise only when exactly one fits', async () => {
    const store = new WorkoutDB('l-plan')
    await saveExercise({ ...newExercise('lb'), name: 'Leg Press', equipment: 'machine' }, store)
    await saveExercise({ ...newExercise('lb'), name: 'Row', equipment: 'cable' }, store)
    await saveExercise({ ...newExercise('lb'), name: 'Row', equipment: 'dumbbell' }, store)
    const lib = await store.exercises.toArray()
    const { sessions } = parseLegacy([
      record('2026-01-01', 'lower', [press, curl, { name: 'row', sets: [{ weight: 1, reps: 1 }] }, { name: 'ROW', equipment: 'cable', sets: [{ weight: 1, reps: 1 }] }]),
    ])
    const items = planImport(sessions, lib)
    const by = (n: string, eq?: string) => items.find((i) => i.id === `${n}|${eq ?? ''}`)!
    expect(by('leg press', 'machine').matchedId).toBeDefined()
    expect(by('db curl', 'dumbbell').matchedId).toBeUndefined()
    expect(by('row').matchedId).toBeUndefined() // ambiguous: cable or dumbbell
    expect(by('row', 'cable').matchedId).toBeDefined()
  })

  it('guesses a kind and builds an editable draft', () => {
    expect(guessKind('Back Squat', 'barbell')).toBe('compound-lower')
    expect(guessKind('Bicep Curl', 'dumbbell')).toBe('isolation')
    expect(guessKind('Bench Press', 'barbell')).toBe('compound-upper')
    expect(guessKind('Leg Press', 'machine')).toBe('machine')
    expect(draftExercise('Hammer Curl', undefined, 'lb')).toMatchObject({ kind: 'isolation', equipment: 'dumbbell', step: 5 })
  })
})

describe('import', () => {
  async function run(store: WorkoutDB, res: (id: string) => Resolution) {
    const parsed = parseLegacy([
      record('2026-01-01', 'lower', [press], { notes: 'travelled all day, poor sleep' }),
      record('2026-01-01', 'upper', [curl]),
      record('2026-01-08', 'lower', [press]),
    ])
    const plan = planImport(parsed.sessions, [])
    const resolutions = Object.fromEntries(plan.map((p) => [p.id, res(p.id)]))
    return { parsed, resolutions, result: await importLegacy(parsed.sessions, resolutions, store) }
  }
  const create = (store: WorkoutDB) => (id: string): Resolution => ({
    kind: 'create',
    exercise: draftExercise(id.split('|')[0].replace(/\b\w/g, (c) => c.toUpperCase()), id.endsWith('machine') ? 'machine' : 'dumbbell', 'lb'),
  })

  it('creates Sessions in original units, closed, and creates the Exercises', async () => {
    const store = new WorkoutDB('l-import')
    const { result } = await run(store, create(store))
    expect(result).toMatchObject({ imported: 3, duplicates: 0, created: 2 })
    const sessions = await store.sessions.toArray()
    expect(sessions.every((s) => s.closedAt !== undefined && s.legacyKey)).toBe(true)
    const upper = sessions.find((s) => s.type === 'upper')!
    expect(upper.sets[0]).toMatchObject({ weight: 10, unit: 'kg', reps: 12 })
    expect(await store.exercises.count()).toBe(2)
  })

  it('keeps two Sessions on the same day in order', async () => {
    const store = new WorkoutDB('l-order')
    await run(store, create(store))
    const day = (await store.sessions.toArray()).filter((s) => s.date === '2026-01-01').sort((a, b) => a.startedAt - b.startedAt)
    expect(day.map((s) => s.type)).toEqual(['lower', 'upper'])
  })

  it('does not duplicate Sessions when the same export is imported again', async () => {
    const store = new WorkoutDB('l-dupe')
    const first = await run(store, create(store))
    const again = await importLegacy(first.parsed.sessions, first.resolutions, store)
    expect(again).toMatchObject({ imported: 0, duplicates: 3, created: 0 })
    expect(await store.sessions.count()).toBe(3)
    expect(await store.exercises.count()).toBe(2)
  })

  it('maps to an existing Exercise and skips ones the lifter drops', async () => {
    const store = new WorkoutDB('l-map')
    const existing = await saveExercise({ ...newExercise('lb'), name: 'Sled Press', equipment: 'machine' }, store)
    const { result } = await run(store, (id) => (id.startsWith('leg press') ? { kind: 'map', exerciseId: existing } : { kind: 'skip' }))
    expect(result).toMatchObject({ imported: 2, created: 0, skippedExercises: 1 })
    expect((await store.sessions.toArray()).every((s) => s.exerciseIds.every((id) => id === existing))).toBe(true)
  })

  it('turns clear confounder phrases in notes into chips, and keeps the note text', async () => {
    const store = new WorkoutDB('l-chips')
    await run(store, create(store))
    const lower = (await store.sessions.toArray()).find((s) => s.date === '2026-01-01' && s.type === 'lower')!
    const id = lower.exerciseIds[0]
    expect(lower.exerciseChips?.[id]?.sort()).toEqual(['poor sleep', 'travel'])
    const upper = (await store.sessions.toArray()).find((s) => s.type === 'upper')!
    expect(upper.sets[0].note).toBe('felt heavy')
    expect(upper.sets[0].chips).toBeUndefined()
  })

  it('only matches clear confounder phrases', () => {
    expect(confoundersIn('slept badly, cold gym')).toEqual(['poor sleep', 'ill'])
    expect(confoundersIn('felt strong, slept well')).toEqual([])
    expect(confoundersIn('missed breakfast')).toEqual(['missed food'])
    expect(confoundersIn(undefined)).toEqual([])
  })
})

describe('routine seeding', () => {
  it('seeds missing Routines from the latest Session of each type, and never overwrites', async () => {
    const store = new WorkoutDB('l-seed')
    const parsed = parseLegacy([
      record('2026-01-01', 'lower', [{ name: 'Old', equipment: 'machine', sets: [{ weight: 1, reps: 1 }] }]),
      record('2026-01-08', 'lower', [press, { name: 'Calf Raise', equipment: 'machine', sets: [{ weight: 50, reps: 15 }, { weight: 50, reps: 15 }, { weight: 50, reps: 14 }, { weight: 0, reps: 1 }] }]),
      record('2026-01-09', 'upper', [curl]),
    ])
    const plan = planImport(parsed.sessions, [])
    await importLegacy(parsed.sessions, Object.fromEntries(plan.map((p) => [p.id, { kind: 'create', exercise: draftExercise(p.name, p.equipment, 'lb') } as Resolution])), store)
    expect(await seedRoutines(store)).toEqual(['upper', 'lower'])
    const lower = (await store.routines.where('sessionType').equals('lower').first())!
    const names = await Promise.all(lower.entries.map(async (e) => (await store.exercises.get(e.exerciseId))!.name))
    expect(names).toEqual(['Leg Press', 'Calf Raise'])
    expect(lower.entries.map((e) => e.targetSets)).toEqual([2, 4])
    expect(await seedRoutines(store)).toEqual([])
    expect(await store.routines.count()).toBe(2)
  })
})
