import { describe, expect, it } from 'vitest'
import type { Routine, Session } from './db'
import { fmtClock, isFinalSet, restFor, restView } from './rest'

const routine: Routine = {
  sessionType: 'lower',
  entries: [
    { exerciseId: 1, targetSets: 3, repMin: 6, repMax: 10, restCategory: 'heavy' },
    { exerciseId: 2, targetSets: 2, repMin: 10, repMax: 15, restCategory: 'isolation' },
  ],
}
const mk = (sets: [number, boolean][], timer = true): Session => ({
  date: '2026-10-26', type: 'lower', location: 'gym', trainer: false, timer, startedAt: 0,
  exerciseIds: [1, 2],
  sets: sets.map(([exerciseId, warmup], i) => ({ id: String(i), at: i, exerciseId, weight: 100, unit: 'lb', reps: 8, warmup })),
})

describe('rest timer', () => {
  it('uses the Exercise rest category after a working Set', () => {
    expect(restFor(mk([[1, false]]), routine, { exerciseId: 1, warmup: false }, 'heavy')).toBe(120)
    expect(restFor(mk([[1, false]]), routine, { exerciseId: 1, warmup: false }, 'moderate')).toBe(90)
    expect(restFor(mk([[2, false]]), routine, { exerciseId: 2, warmup: false }, 'isolation')).toBe(60)
  })

  it('is skipped for warmups and when the Session timer is off', () => {
    expect(restFor(mk([[1, true]]), routine, { exerciseId: 1, warmup: true }, 'heavy')).toBeNull()
    expect(restFor(mk([[1, false]], false), routine, { exerciseId: 1, warmup: false }, 'heavy')).toBeNull()
  })

  it('is skipped after the last Set of the last Exercise only', () => {
    expect(isFinalSet(mk([[2, false]]), routine, 2)).toBe(false)
    expect(isFinalSet(mk([[2, false], [2, false]]), routine, 2)).toBe(true)
    // warmups do not count toward the target
    expect(isFinalSet(mk([[2, true], [2, false]]), routine, 2)).toBe(false)
    // the last set of an earlier Exercise still rests
    expect(isFinalSet(mk([[1, false], [1, false], [1, false]]), routine, 1)).toBe(false)
    // without a Routine the end of the workout is unknown
    expect(isFinalSet(mk([[2, false], [2, false]]), undefined, 2)).toBe(false)
  })

  it('counts down from the start timestamp and then reports the actual rest', () => {
    const t = { startedAt: 1_000, total: 90 }
    expect(restView(t, 1_000 + 30_000)).toEqual({ left: 60, elapsed: 30, done: false })
    expect(restView(t, 1_000 + 90_000)).toEqual({ left: 0, elapsed: 90, done: true })
    expect(restView(t, 1_000 + 192_000)).toEqual({ left: 0, elapsed: 192, done: true })
  })

  it('formats the clock', () => {
    expect(fmtClock(90)).toBe('1:30')
    expect(fmtClock(65)).toBe('1:05')
    expect(fmtClock(0)).toBe('0:00')
  })
})
