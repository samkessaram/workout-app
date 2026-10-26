import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { backupNudge, ensureFirstRun, exportAll, importAll, markExported, NUDGE_AFTER_DAYS, parseBackup } from './backup'
import { SCHEMA_VERSION, WorkoutDB } from './db'
import { newExercise, saveExercise } from './exercises'
import { raiseFlag } from './pain'
import { saveRoutine, entryFor } from './routines'
import { addSet, startSession } from './sessions'
import { setSetting } from './settings.svelte'

const DAY = 24 * 60 * 60 * 1000

async function populate(store: WorkoutDB) {
  const ex = await saveExercise({ ...newExercise('lb'), name: 'Leg Press', equipment: 'machine' }, store)
  await saveRoutine({ sessionType: 'lower', entries: [entryFor((await store.exercises.get(ex))!)] }, store)
  const sid = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: true }, store)
  await addSet(sid, { exerciseId: ex, weight: 180, unit: 'lb', reps: 10, warmup: false }, store)
  await raiseFlag({ exerciseId: ex, severity: 'dull', action: 'continue' }, store)
  await store.suggestionLog.add({ sessionId: sid, exerciseId: ex, stage: 'CALIBRATION', rule: 'x', suggested: {} })
  await setSetting('unit', 'kg', store)
  await setSetting('restTimer', { startedAt: 1, total: 60 }, store)
}

describe('backup', () => {
  it('round-trips every store into a fresh install, minus transient settings', async () => {
    const a = new WorkoutDB('b-a')
    await populate(a)
    const file = await exportAll(a)
    expect(file.schemaVersion).toBe(SCHEMA_VERSION)

    const b = new WorkoutDB('b-b')
    await importAll(JSON.stringify(file), b)
    for (const t of ['exercises', 'routines', 'sessions', 'painFlags', 'suggestionLog']) {
      expect(await b.table(t).toArray()).toEqual(await a.table(t).toArray())
    }
    expect((await b.settings.toArray()).map((s) => s.key)).toEqual(['unit'])
  })

  it('replaces existing data rather than merging', async () => {
    const a = new WorkoutDB('b-replace-a')
    await populate(a)
    const b = new WorkoutDB('b-replace-b')
    await saveExercise({ ...newExercise('lb'), name: 'Old' }, b)
    await importAll(JSON.stringify(await exportAll(a)), b)
    expect((await b.exercises.toArray()).map((e) => e.name)).toEqual(['Leg Press'])
  })

  it('refuses newer schemas, foreign files and garbage', () => {
    const base = { app: 'workout', data: { exercises: [], routines: [], sessions: [], painFlags: [], suggestionLog: [], settings: [] } }
    expect(() => parseBackup(JSON.stringify({ ...base, schemaVersion: SCHEMA_VERSION + 1 }))).toThrow(/newer version/)
    expect(() => parseBackup(JSON.stringify({ ...base, app: 'other', schemaVersion: 1 }))).toThrow(/not a Workout backup/)
    expect(() => parseBackup('nope')).toThrow(/not valid JSON/)
    expect(() => parseBackup(JSON.stringify({ ...base, schemaVersion: 1, data: { exercises: [] } }))).toThrow(/missing/)
  })

  it('leaves the database untouched when the import is refused', async () => {
    const a = new WorkoutDB('b-refuse')
    await populate(a)
    await expect(importAll('{"app":"workout","schemaVersion":999,"data":{}}', a)).rejects.toThrow()
    expect(await a.exercises.count()).toBe(1)
  })

  it('nudges after 14 days without an export and clears after exporting', async () => {
    const store = new WorkoutDB('b-nudge')
    const t0 = 1_000_000_000_000
    expect(await backupNudge(store, t0)).toBe(false)
    await ensureFirstRun(store, t0)
    expect(await backupNudge(store, t0 + (NUDGE_AFTER_DAYS - 1) * DAY)).toBe(false)
    expect(await backupNudge(store, t0 + NUDGE_AFTER_DAYS * DAY)).toBe(true)
    await markExported(store, t0 + NUDGE_AFTER_DAYS * DAY)
    expect(await backupNudge(store, t0 + NUDGE_AFTER_DAYS * DAY + 1)).toBe(false)
    expect(await backupNudge(store, t0 + 2 * NUDGE_AFTER_DAYS * DAY)).toBe(true)
  })
})
