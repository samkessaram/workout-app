import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { hasConfounder, isConfounder, setExerciseNote, setSetNote, toggleExerciseChip, toggleSetChip, withCustomChip } from './chips'
import { WorkoutDB } from './db'
import { exerciseHistory } from './history'
import { addSet, startSession } from './sessions'

const opts = { type: 'upper' as const, location: 'gym', trainer: false, timer: true }
const s1 = { exerciseId: 1, weight: 100, unit: 'lb' as const, reps: 8, warmup: false }

describe('chips', () => {
  it('knows which chips are confounders', () => {
    expect(['poor sleep', 'ill', 'travel', 'missed food', 'injury'].every(isConfounder)).toBe(true)
    expect(isConfounder('shaky')).toBe(false)
    expect(hasConfounder(['shaky', 'travel'])).toBe(true)
    expect(hasConfounder(['shaky'])).toBe(false)
  })

  it('adds custom chips once, normalised, never duplicating built-ins', () => {
    expect(withCustomChip([], '  Sore  Elbow ')).toEqual(['sore elbow'])
    expect(withCustomChip(['sore elbow'], 'Sore elbow')).toEqual(['sore elbow'])
    expect(withCustomChip([], 'Shaky')).toEqual([])
    expect(withCustomChip([], '   ')).toEqual([])
  })

  it('toggles Set and Exercise chips and stores notes, readable as history chips', async () => {
    const store = new WorkoutDB('chips-session')
    const id = await startSession(opts, store, 1000)
    const set = await addSet(id, s1, store)
    await toggleSetChip(id, set.id, 'shaky', store)
    await toggleExerciseChip(id, 1, 'poor sleep', store)
    await setSetNote(id, set.id, ' left knee clicked ', store)
    await setExerciseNote(id, 1, 'new machine', store)
    const s = (await store.sessions.get(id))!
    expect(s.sets[0]).toMatchObject({ chips: ['shaky'], note: 'left knee clicked' })
    expect(s.exerciseChips?.[1]).toEqual(['poor sleep'])
    expect(s.exerciseNotes?.[1]).toBe('new machine')
    const [h] = await exerciseHistory(1, store)
    expect(hasConfounder(h.chips)).toBe(true)

    await toggleSetChip(id, set.id, 'shaky', store)
    await setExerciseNote(id, 1, '', store)
    const after = (await store.sessions.get(id))!
    expect(after.sets[0].chips).toEqual([])
    expect(after.exerciseNotes?.[1]).toBeUndefined()
  })
})
