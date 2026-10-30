import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { WorkoutDB } from './db'
import { exerciseHistory, repChips, weightChips } from './history'
import { stepIn } from './units'
import { addSet, autoCloseStale, AUTO_CLOSE_MS, closeSession, correctSet, deleteSession, getActiveSession, startSession } from './sessions'

const opts = { type: 'lower' as const, location: 'gym', trainer: false, timer: true }
const set = (exerciseId: number, weight: number, reps: number, warmup = false, unit: 'lb' | 'kg' = 'lb') => ({
  exerciseId, weight, reps, warmup, unit,
})

describe('sessions', () => {
  it('logs sets, closes, and keeps units as entered', async () => {
    const store = new WorkoutDB('s-basic')
    const id = await startSession(opts, store)
    await addSet(id, set(1, 100, 10, true), store)
    await addSet(id, set(1, 60, 8, false, 'kg'), store)
    const s = await closeSession(id, store)
    expect(s.exerciseIds).toEqual([1])
    expect(s.sets.map((x) => [x.weight, x.unit, x.warmup])).toEqual([[100, 'lb', true], [60, 'kg', false]])
    expect(await getActiveSession(store)).toBeUndefined()
  })

  it('resumes an open Session with every confirmed set', async () => {
    const store = new WorkoutDB('s-resume')
    const id = await startSession(opts, store)
    await addSet(id, set(1, 100, 10), store)
    await addSet(id, set(2, 50, 12), store)
    const again = await getActiveSession(new WorkoutDB('s-resume'))
    expect(again?.id).toBe(id)
    expect(again?.sets).toHaveLength(2)
  })

  it('deletes a Session with its Suggestion log, leaving other Sessions alone', async () => {
    const store = new WorkoutDB('s-delete')
    const keep = await startSession(opts, store, 1000)
    const drop = await startSession(opts, store, 2000)
    await store.suggestionLog.bulkAdd([
      { sessionId: keep, exerciseId: 1, stage: 'CALIBRATION', rule: 'calibration', suggested: {} },
      { sessionId: drop, exerciseId: 1, stage: 'CALIBRATION', rule: 'calibration', suggested: {} },
    ])
    await deleteSession(drop, store)
    expect(await store.sessions.get(drop)).toBeUndefined()
    expect(await store.sessions.get(keep)).toBeDefined()
    expect((await store.suggestionLog.toArray()).map((e) => e.sessionId)).toEqual([keep])
  })

  it('refuses to add to a closed Session', async () => {
    const store = new WorkoutDB('s-closed')
    const id = await startSession(opts, store)
    await closeSession(id, store)
    await expect(addSet(id, set(1, 100, 10), store)).rejects.toThrow(/closed/)
  })

  it('auto-closes a Session open over 6 hours, as it stands', async () => {
    const store = new WorkoutDB('s-stale')
    const t0 = 1_000_000
    const id = await startSession(opts, store, t0)
    await addSet(id, set(1, 100, 10), store, t0 + 60_000)
    expect(await autoCloseStale(store, t0 + AUTO_CLOSE_MS)).toEqual([])
    expect(await autoCloseStale(store, t0 + 60_000 + AUTO_CLOSE_MS + 1)).toEqual([id])
    const s = (await store.sessions.get(id))!
    expect(s.closedAt).toBe(t0 + 60_000)
    expect(s.sets).toHaveLength(1)
  })
})

describe('history chips', () => {
  it('recommends the last working weight with one step either side', async () => {
    const store = new WorkoutDB('h-chips')
    const id = await startSession(opts, store, 1000)
    await addSet(id, set(1, 50, 12, true), store)
    await addSet(id, set(1, 100, 8), store)
    await closeSession(id, store)
    const history = await exerciseHistory(1, store)
    expect(weightChips(history, { step: 5, stepUnit: 'lb' }, 'lb')).toEqual({ recommended: 100, options: [95, 100, 105] })
  })

  it('converts the last weight into the active unit and rounds to a loadable step', async () => {
    const store = new WorkoutDB('h-conv')
    const id = await startSession(opts, store, 1000)
    await addSet(id, set(1, 100, 8, false, 'lb'), store)
    const history = await exerciseHistory(1, store)
    const chips = weightChips(history, { step: 5, stepUnit: 'lb' }, 'kg')
    expect(chips.recommended).toBe(45)
  })

  it('has no chips without history and can exclude the open Session', async () => {
    const store = new WorkoutDB('h-none')
    const id = await startSession(opts, store)
    await addSet(id, set(1, 100, 8), store)
    expect(await exerciseHistory(1, store, { excludeSessionId: id })).toEqual([])
    expect(weightChips([], { step: 5, stepUnit: 'lb' }, 'lb')).toEqual({ options: [] })
  })

  it('caps rep chips at 6 across the range', () => {
    expect(repChips(6, 10)).toEqual([6, 7, 8, 9, 10])
    expect(repChips(10, 20)).toHaveLength(6)
    expect(repChips(10, 20)[0]).toBe(10)
    expect(repChips(10, 20).at(-1)).toBe(20)
  })

  it('converts the step between units', () => {
    expect(stepIn({ step: 5, stepUnit: 'lb' }, 'lb')).toBe(5)
    expect(stepIn({ step: 5, stepUnit: 'lb' }, 'kg')).toBe(2.25)
  })
})

describe('corrections', () => {
  it('keeps the previous value and uses the corrected one for history and chips', async () => {
    const store = new WorkoutDB('c-basic')
    const id = await startSession(opts, store, 1000)
    const logged = await addSet(id, set(1, 180, 10), store)
    await correctSet(id, logged.id, { weight: 170, unit: 'lb', reps: 10 }, store, 2000)
    const s = (await store.sessions.get(id))!
    expect(s.sets[0]).toMatchObject({ weight: 170, reps: 10, prev: [{ weight: 180, unit: 'lb', reps: 10, at: 2000 }] })
    const history = await exerciseHistory(1, store)
    expect(weightChips(history, { step: 5, stepUnit: 'lb' }, 'lb').recommended).toBe(170)
  })

  it('chains corrections oldest first and ignores a no-op', async () => {
    const store = new WorkoutDB('c-chain')
    const id = await startSession(opts, store)
    const logged = await addSet(id, set(1, 100, 8), store)
    await correctSet(id, logged.id, { weight: 100, unit: 'lb', reps: 8 }, store)
    expect((await store.sessions.get(id))!.sets[0].prev).toBeUndefined()
    await correctSet(id, logged.id, { weight: 105, unit: 'lb', reps: 8 }, store)
    await correctSet(id, logged.id, { weight: 105, unit: 'lb', reps: 9 }, store)
    const set0 = (await store.sessions.get(id))!.sets[0]
    expect(set0.prev?.map((p) => [p.weight, p.reps])).toEqual([[100, 8], [105, 8]])
    expect([set0.weight, set0.reps]).toEqual([105, 9])
  })

  it('works on a closed Session and rejects unknown Sets', async () => {
    const store = new WorkoutDB('c-closed')
    const id = await startSession(opts, store)
    const logged = await addSet(id, set(1, 100, 8), store)
    await closeSession(id, store)
    await correctSet(id, logged.id, { weight: 95, unit: 'lb', reps: 8 }, store)
    expect((await store.sessions.get(id))!.sets[0].weight).toBe(95)
    await expect(correctSet(id, 'nope', { weight: 1, unit: 'lb', reps: 1 }, store)).rejects.toThrow()
  })
})
