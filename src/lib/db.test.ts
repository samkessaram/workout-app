import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, WorkoutDB } from './db'
import { getSetting, setSetting } from './settings.svelte'

describe('database', () => {
  it('opens with every store from the spec', async () => {
    const store = new WorkoutDB('test-stores')
    await store.open()
    expect(store.tables.map((t) => t.name).sort()).toEqual(
      ['exercises', 'painFlags', 'routines', 'sessions', 'settings', 'suggestionLog'],
    )
    expect(store.verno).toBe(SCHEMA_VERSION)
  })

  it('persists the unit setting without rewriting stored weights', async () => {
    const store = new WorkoutDB('test-unit')
    expect(await getSetting('unit', 'lb', store)).toBe('lb')
    await setSetting('unit', 'kg', store)
    expect(await getSetting('unit', 'lb', store)).toBe('kg')

    const id = await store.sessions.add({
      date: '2026-10-26', type: 'lower', location: 'gym', trainer: false, timer: true,
      startedAt: 0, exerciseIds: [1],
      sets: [{ id: 'a', at: 0, exerciseId: 1, weight: 135, unit: 'lb', reps: 8, warmup: false }],
    })
    await setSetting('unit', 'kg', store)
    expect((await store.sessions.get(id))!.sets[0]).toMatchObject({ weight: 135, unit: 'lb' })
  })
})
