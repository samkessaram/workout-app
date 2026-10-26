import { describe, expect, it } from 'vitest'
import { detectDeload, type DeloadCandidate } from './deload'
import { suggest } from './suggest'
import type { EngineExercise, EngineSession } from './types'

const DAY = 86_400_000
const press: EngineExercise = { kind: 'compound-upper', step: 5, stepUnit: 'lb', repMin: 6, repMax: 10 } // NOVICE, target 8
const machine: EngineExercise = { kind: 'machine', step: 5, stepUnit: 'lb', repMin: 8, repMax: 12 }

let id = 0
/** Sessions on explicit day numbers: [day, weight, reps[], chips?]. */
function on(rows: [number, number, number[], string[]?][]): EngineSession[] {
  return rows.map(([day, w, reps, chips]) => ({
    sessionId: ++id,
    date: `day${day}`,
    startedAt: day * DAY,
    location: 'gym',
    chips: chips ?? [],
    sets: reps.map((r) => ({ weight: w, unit: 'lb' as const, reps: r, warmup: false })),
  }))
}
const ask = (ex: EngineExercise, history: EngineSession[], nowDay: number, deloads?: { from: number; until: number }[]) =>
  suggest({ exercise: ex, history, unit: 'lb', now: nowDay * DAY, deloads })
const base = (): [number, number, number[]][] => [[0, 100, [8, 8, 8]], [7, 105, [8, 8, 8]], [14, 110, [8, 8, 8]], [21, 115, [8, 8, 8]]]

describe('post-layoff re-ramp', () => {
  it('starts at 87.5% of the last working weight after a gap of 21+ days', () => {
    const s = ask(press, on(base()), 21 + 21)
    expect(s).toMatchObject({ rule: 're-ramp', weight: 100, reps: 8, stage: 'NOVICE' }) // 115 * 0.875 = 100.6 -> 100
    expect(s.reason).toMatch(/layoff/i)
  })

  it('does not start before 21 days', () => {
    expect(ask(press, on(base()), 21 + 20).rule).toBe('novice-increase')
  })

  it('steps back up over three Sessions, then normal rules resume', () => {
    const back = (...rows: [number, number, number[]][]) => on([...base(), ...rows])
    expect(ask(press, back([49, 100, [8, 8, 8]]), 56)).toMatchObject({ rule: 're-ramp', weight: 110 }) // 93.75% of 115 = 107.8
    expect(ask(press, back([49, 100, [8, 8, 8]], [56, 110, [8, 8, 8]]), 63)).toMatchObject({ rule: 're-ramp', weight: 115 })
    expect(ask(press, back([49, 100, [8, 8, 8]], [56, 110, [8, 8, 8]], [63, 115, [8, 8, 8]]), 70)).toMatchObject({ rule: 'novice-increase', weight: 120 })
  })

  it('resumes normal rules early when the lifter is already above the ramp', () => {
    expect(ask(press, on([...base(), [49, 115, [8, 8, 8]]]), 56).rule).toBe('novice-increase')
  })

  it('does not count stalls while re-ramping', () => {
    const miss = (day: number, w: number): [number, number, number[]] => [day, w, [8, 7, 7]]
    const history = on([...base(), miss(49, 100), miss(56, 105), miss(63, 110)])
    // three misses back from a layoff are not a stall run: this is a repeat, not a reset or swap
    expect(ask(press, history, 70).rule).toBe('novice-repeat')
  })

  it('leaves calibration alone', () => {
    expect(ask(machine, on([[0, 100, [10, 10, 10]]]), 100).rule).toBe('calibration')
  })

  it('applies to double progression too', () => {
    const history = on([[0, 100, [12, 12, 12]], [7, 100, [12, 12, 12]], [14, 100, [12, 12, 12]], [21, 100, [10, 10, 10]]])
    expect(ask(machine, history, 60)).toMatchObject({ rule: 're-ramp', weight: 90, stage: 'EARLY_INT' }) // 87.5 -> 90
  })
})

describe('deload overlay', () => {
  const history = () => on([[0, 100, [12, 12, 12]], [7, 100, [12, 12, 12]], [14, 100, [12, 12, 12]]])

  it('cuts the load to 90% during an active deload', () => {
    const s = ask(machine, history(), 16, [{ from: 15 * DAY, until: 22 * DAY }])
    expect(s).toMatchObject({ rule: 'deload', weight: 95 }) // 105 * 0.9 = 94.5 -> 95
    expect(s.reason).toMatch(/half the sets/)
  })

  it('ignores Sessions done during a deload and restores the working load afterwards', () => {
    const h = on([[0, 100, [12, 12, 12]], [7, 100, [12, 12, 12]], [14, 100, [12, 12, 12]], [17, 95, [10, 10, 10]], [20, 95, [10, 10, 10]]])
    const s = ask(machine, h, 30, [{ from: 15 * DAY, until: 22 * DAY }])
    expect(s).toMatchObject({ rule: 'dp-increase', weight: 105 })
  })

  it('resets the stall run at the end of a deload', () => {
    const ok: [number, number, number[]][] = [[0, 100, [8, 8, 8]], [7, 105, [8, 8, 8]], [14, 110, [8, 8, 8]]]
    const stalls: [number, number, number[]][] = [[21, 115, [8, 7, 7]], [28, 115, [8, 7, 7]]]
    expect(ask(press, on([...ok, ...stalls]), 35).rule).toBe('stall-reset')
    const after = ask(press, on([...ok, ...stalls]), 45, [{ from: 30 * DAY, until: 37 * DAY }])
    expect(after.rule).toBe('novice-repeat') // the two stalls no longer count toward the ladder
  })
})

describe('reactive deload detection', () => {
  const cand = (name: string, muscle: string, stallDays: number[], exposures: DeloadCandidate['exposures'] = []): DeloadCandidate => ({
    exerciseId: id++, name, muscle, stalls: stallDays.map((d) => d * DAY), exposures,
  })

  it('triggers on 3 stalled Exercises for one muscle within 14 days', () => {
    const advice = detectDeload([cand('Bench', 'chest', [30]), cand('Fly', 'chest', [33]), cand('Dip', 'chest', [35])], 36 * DAY)
    expect(advice).toMatchObject({ kind: 'stalls', muscle: 'chest' })
    expect(advice!.reason).toMatch(/Bench, Fly, Dip/)
  })

  it('does not trigger on two, on three muscles, or on stalls older than 14 days', () => {
    expect(detectDeload([cand('Bench', 'chest', [30]), cand('Fly', 'chest', [33])], 36 * DAY)).toBeUndefined()
    expect(detectDeload([cand('Bench', 'chest', [30]), cand('Row', 'back', [33]), cand('Squat', 'quads', [35])], 36 * DAY)).toBeUndefined()
    expect(detectDeload([cand('Bench', 'chest', [10]), cand('Fly', 'chest', [12]), cand('Dip', 'chest', [14])], 36 * DAY)).toBeUndefined()
  })

  it('triggers when average reps are 15% or more below the 4-week best at the same weight', () => {
    const e = (day: number, weight: number, avgReps: number) => ({ startedAt: day * DAY, weight, avgReps })
    const down = cand('Press', 'chest', [], [e(1, 100, 12), e(8, 100, 11), e(15, 100, 10)])
    expect(detectDeload([down], 16 * DAY)).toMatchObject({ kind: 'reps', exerciseId: down.exerciseId })
    const small = cand('Press', 'chest', [], [e(1, 100, 12), e(15, 100, 10.5)]) // 12.5% down
    expect(detectDeload([small], 16 * DAY)).toBeUndefined()
    const otherWeight = cand('Press', 'chest', [], [e(1, 100, 12), e(15, 120, 8)])
    expect(detectDeload([otherWeight], 16 * DAY)).toBeUndefined()
    const old = cand('Press', 'chest', [], [e(1, 100, 12), e(40, 100, 9)])
    expect(detectDeload([old], 41 * DAY)).toBeUndefined() // best was over 4 weeks earlier
  })
})
