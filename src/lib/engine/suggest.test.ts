import { describe, expect, it } from 'vitest'
import { suggest } from './suggest'
import type { EngineExercise, EngineSession } from './types'

const lower: EngineExercise = { kind: 'compound-lower', step: 5, stepUnit: 'lb', repMin: 6, repMax: 10 }
const upper: EngineExercise = { kind: 'compound-upper', step: 5, stepUnit: 'lb', repMin: 6, repMax: 10 }
const machine: EngineExercise = { kind: 'machine', step: 5, stepUnit: 'lb', repMin: 8, repMax: 12 }
const iso: EngineExercise = { kind: 'isolation', step: 5, stepUnit: 'lb', repMin: 10, repMax: 15 }

let n = 0
/** A Session of working sets given as [weight, reps]; a third element true marks a warmup. */
function sess(sets: [number, number, boolean?][], over: Partial<EngineSession> = {}, unit: 'lb' | 'kg' = 'lb'): EngineSession {
  n++
  return {
    sessionId: n,
    date: `2026-01-${String(n).padStart(2, '0')}`,
    startedAt: n * 86_400_000,
    location: 'gym',
    chips: [],
    sets: sets.map(([weight, reps, warmup]) => ({ weight, reps, warmup: !!warmup, unit })),
    ...over,
  }
}
const straight = (w: number, reps: number[]) => sess(reps.map((r) => [w, r] as [number, number]))
/** Three prior Sessions so calibration is over. */
const calibrated = (w: number, reps: number[]) => [straight(w, reps), straight(w, reps), straight(w, reps)]

const ask = (exercise: EngineExercise, history: EngineSession[], unit: 'lb' | 'kg' = 'lb') =>
  suggest({ exercise, history, unit, now: (history.at(-1)?.startedAt ?? 0) + 86_400_000 })

describe('missing history', () => {
  it('has no weight, says so, and never invents a number', () => {
    const s = ask(lower, [])
    expect(s.weight).toBeNull()
    expect(s.rule).toBe('no-history')
    expect(s.reps).toBe(8)
    expect(s.reason).toMatch(/no history/i)
    expect(s.reason).not.toMatch(/\n/)
  })

  it('treats a history of only warmups as no history', () => {
    expect(ask(lower, [sess([[45, 10, true]])]).rule).toBe('no-history')
  })
})

describe('calibration', () => {
  it('repeats the last weight for the first 3 exposures with no stage logic', () => {
    const one = ask(machine, [straight(100, [12, 12, 12])])
    expect(one).toMatchObject({ weight: 100, reps: 10, rule: 'calibration', stage: 'CALIBRATION' })
    expect(one.reason).toMatch(/1 of 3/)
    const two = ask(machine, [straight(100, [12, 12, 12]), straight(100, [12, 12, 12])])
    expect(two.rule).toBe('calibration')
    expect(two.reason).toMatch(/2 of 3/)
  })

  it('ends after 3 exposures', () => {
    expect(ask(machine, calibrated(100, [12, 12, 12])).stage).not.toBe('CALIBRATION')
  })

  it('does not count partial exposures toward calibration', () => {
    const partial = { ...machine, targetSets: 3 }
    const history = [straight(100, [10, 10, 10]), straight(100, [10, 10]), straight(100, [10, 10]), straight(100, [10, 10])]
    expect(ask(partial, history).reason).toMatch(/1 of 3/)
  })
})

describe('double progression', () => {
  it('holds the weight until every set reaches the top, targeting one more rep', () => {
    const s = ask(machine, calibrated(100, [10, 9, 8]))
    expect(s).toMatchObject({ weight: 100, reps: 9, rule: 'dp-hold' })
    expect(s.reason).toMatch(/12/)
  })

  it('targets the top of the range once close', () => {
    expect(ask(machine, calibrated(100, [12, 12, 11]))).toMatchObject({ weight: 100, reps: 12, rule: 'dp-hold' })
  })

  it('adds one increment and restarts at the bottom of the range after a top hit', () => {
    expect(ask(machine, calibrated(100, [12, 12, 12]))).toMatchObject({ weight: 105, reps: 8, rule: 'dp-increase' })
  })

  it('sizes the step by percent of load per kind, rounded to the smallest step', () => {
    expect(ask(lower, calibrated(200, [10, 10, 10])).weight).toBe(210) // 5%
    expect(ask(upper, calibrated(100, [10, 10, 10])).weight).toBe(105) // 2.5% = 2.5, rounds up to the 5 lb step
    expect(ask({ ...machine, step: 10 }, calibrated(200, [12, 12, 12])).weight).toBe(210) // 4% = 8, rounds to 10
  })

  it('never steps by less than the smallest jump', () => {
    const e = { ...upper, step: 2.5 }
    expect(ask(e, calibrated(45, [10, 10, 10])).weight).toBe(47.5) // 2.5% of 45 rounds to 0
  })

  it('suggests +1 rep when the smallest jump is too big a share of the load', () => {
    const s = ask(iso, calibrated(20, [15, 15, 15])) // 5 lb on 20 lb is 25%
    expect(s).toMatchObject({ weight: 20, reps: 16, rule: 'dp-add-rep' })
  })

  it('stops adding reps after the allowed extension and takes the step anyway', () => {
    expect(ask(iso, calibrated(20, [17, 17, 17])).rule).toBe('dp-add-rep')
    expect(ask(iso, calibrated(20, [18, 18, 18]))).toMatchObject({ weight: 25, reps: 10, rule: 'dp-increase' })
  })

  it('uses only the most recent exposure', () => {
    const history = [...calibrated(100, [12, 12, 12]), straight(105, [8, 8, 8])]
    expect(ask(machine, history)).toMatchObject({ weight: 105, rule: 'dp-hold', reps: 9 })
  })

  it('evaluates sets at the working weight, which is the most common one', () => {
    const ramp = sess([[80, 10], [100, 12], [100, 12], [100, 12]])
    expect(ask(machine, [...calibrated(100, [12, 12, 12]).slice(0, 2), ramp]).weight).toBe(105)
  })

  it('ignores warmups when judging a session', () => {
    const withWarmup = sess([[60, 8, true], [100, 12], [100, 12], [100, 12]])
    expect(ask(machine, [...calibrated(100, [12, 12, 12]).slice(0, 2), withWarmup]).weight).toBe(105)
  })

  it('ignores partial sessions when the Routine target is known', () => {
    const e = { ...machine, targetSets: 3 }
    const history = [...calibrated(100, [10, 10, 10]), straight(110, [12, 12])]
    expect(ask(e, history)).toMatchObject({ weight: 100, rule: 'dp-hold' })
  })
})

describe('units', () => {
  it('converts history into the active unit and rounds to a loadable step', () => {
    const history = [1, 2, 3].map(() => straight(60, [10, 10, 10]).sets).map((sets) => sess(sets.map((s) => [s.weight, s.reps] as [number, number]), {}, 'kg'))
    const s = ask({ ...machine, step: 2.5, stepUnit: 'kg' }, history, 'lb')
    // 60 kg = 132.3 lb, rounded to a 5.5 lb step (2.5 kg), then held
    expect(s.unit).toBe('lb')
    expect(s.weight! % 5.5).toBeCloseTo(0, 5)
  })

  it('expresses Suggestions in the active unit', () => {
    expect(ask(machine, calibrated(100, [10, 9, 8]), 'kg').unit).toBe('kg')
  })
})
