import { describe, expect, it } from 'vitest'
import { suggest } from './suggest'
import type { EngineExercise, EngineSession } from './types'

const DAY = 86_400_000
const squat: EngineExercise = { kind: 'compound-lower', step: 5, stepUnit: 'lb', repMin: 6, repMax: 10 } // NOVICE target 8
const curl: EngineExercise = { kind: 'isolation', step: 5, stepUnit: 'lb', repMin: 10, repMax: 15 }

let id = 0
/** Sessions one week apart. Each entry is [weight, reps[], chips?]. */
function weekly(rows: [number, number[], string[]?][], startDay = 0): EngineSession[] {
  return rows.map(([w, reps, chips], i) => ({
    sessionId: ++id,
    date: `d${i}`,
    startedAt: (startDay + i * 7) * DAY,
    location: 'gym',
    chips: chips ?? [],
    sets: reps.map((r) => ({ weight: w, unit: 'lb' as const, reps: r, warmup: false })),
  }))
}
const ask = (exercise: EngineExercise, history: EngineSession[]) =>
  suggest({ exercise, history, unit: 'lb', now: (history.at(-1)?.startedAt ?? 0) + DAY })
const ok = (w: number): [number, number[]] => [w, [8, 8, 8]]
// A miss without a rep drop of 2+ across sets, so it climbs the ladder one rung at a time.
const miss = (w: number): [number, number[]] => [w, [8, 7, 7]]

describe('NOVICE (compounds, linear)', () => {
  it('adds weight after every successful exposure once calibration is over', () => {
    const s = ask(squat, weekly([ok(100), ok(105), ok(110)]))
    expect(s).toMatchObject({ stage: 'NOVICE', rule: 'novice-increase', weight: 115, reps: 8 })
    const later = ask(squat, weekly([ok(100), ok(105), ok(110), ok(115)]))
    expect(later).toMatchObject({ stage: 'NOVICE', rule: 'novice-increase', weight: 120 })
  })

  it('adds a fixed jump even when it is a big share of a light load', () => {
    const e = { ...squat, kind: 'compound-upper' as const }
    expect(ask(e, weekly([ok(45), ok(45), ok(45)]))).toMatchObject({ rule: 'novice-increase', weight: 50 })
  })

  it('repeats when the target was missed straight after calibration', () => {
    expect(ask(squat, weekly([ok(100), ok(105), miss(110)]))).toMatchObject({ rule: 'novice-repeat', weight: 110 })
  })

  it('climbs the stall ladder: repeat, then reset 10%, then swap or drop 5%', () => {
    const base: [number, number[]][] = [ok(100), ok(105), ok(110)]
    const one = ask(squat, weekly([...base, miss(115)]))
    expect(one).toMatchObject({ stage: 'NOVICE', rule: 'stall-repeat', weight: 115, reps: 8 })
    const two = ask(squat, weekly([...base, miss(115), miss(115)]))
    expect(two).toMatchObject({ rule: 'stall-reset', weight: 105 }) // 115 - 10% = 103.5 -> 105
    const three = ask(squat, weekly([...base, miss(115), miss(115), miss(105)]))
    expect(three).toMatchObject({ rule: 'stall-swap', weight: 100 }) // 105 - 5% = 99.75 -> 100
    expect(three.reason).toMatch(/swap the variation/i)
  })

  it('goes straight to the third rung on a rep drop of 2+ across sets at a stall', () => {
    const drop: [number, number[]] = [115, [9, 8, 6]]
    expect(ask(squat, weekly([ok(100), ok(105), ok(110), drop]))).toMatchObject({ rule: 'stall-swap', weight: 110 })
  })

  it('does not count a stall that carries a confounder chip, and repeats instead', () => {
    const history = weekly([ok(100), ok(105), ok(110), [115, [8, 7, 7], ['poor sleep']]])
    const s = ask(squat, history)
    expect(s).toMatchObject({ rule: 'stall-ignored', weight: 115 })
    expect(s.reason).toMatch(/poor sleep/)
  })

  it('lets confounded stalls neither count nor break the run', () => {
    const history = weekly([ok(100), ok(105), ok(110), miss(115), [115, [8, 7, 7], ['travel']], miss(115)])
    // two counted stalls (the travel one is skipped): reset, not swap
    expect(ask(squat, history)).toMatchObject({ rule: 'stall-reset', weight: 105 })
  })

  it('treats a note chip that is not a confounder as an ordinary stall', () => {
    expect(ask(squat, weekly([ok(100), ok(105), ok(110), [115, [8, 7, 7], ['shaky']]]))).toMatchObject({ rule: 'stall-repeat' })
  })

  it('rebuilds after a reset: success at the lower load adds weight again', () => {
    const history = weekly([ok(100), ok(105), ok(110), miss(115), miss(115), ok(105)])
    expect(ask(squat, history)).toMatchObject({ rule: 'novice-increase', weight: 110 })
  })
})

describe('leaving NOVICE', () => {
  it('moves a flat compound to EARLY_INT once 8 weeks of history exist', () => {
    const flat = weekly(Array.from({ length: 10 }, () => ok(100)))
    // Under EARLY_INT rules, no rep progress at the same weight is itself a stall.
    expect(ask(squat, flat)).toMatchObject({ stage: 'EARLY_INT', rule: 'stall-repeat', weight: 100 })
  })

  it('keeps a flat compound on NOVICE inside the 8-week gate', () => {
    const flat = weekly(Array.from({ length: 6 }, () => ok(100)))
    expect(ask(squat, flat)).toMatchObject({ stage: 'NOVICE', rule: 'novice-increase' })
  })

  it('keeps a progressing novice on NOVICE', () => {
    const rising = weekly(Array.from({ length: 12 }, (_, i) => ok(100 + i * 5)))
    expect(ask(squat, rising)).toMatchObject({ stage: 'NOVICE', rule: 'novice-increase', weight: 165 }) // 5% of 155 rounds to a 10 lb jump
  })

  it('moves a lift that keeps stalling to EARLY_INT after the gate', () => {
    // Strong early progress keeps the e1RM slope up, so only the four stalls in a row can move it.
    const rows: [number, number[]][] = [ok(100), ok(105), ok(110), ok(115), ok(120), ok(125), ok(130), miss(135), miss(135), miss(135), miss(135)]
    expect(ask(squat, weekly(rows)).stage).toBe('EARLY_INT')
    expect(ask(squat, weekly(rows.slice(0, -1))).stage).toBe('NOVICE')
  })

  it('does not leave NOVICE on a stalling lift before the gate', () => {
    const s = ask(squat, weekly([ok(100), ok(105), ok(110), miss(115), miss(115), miss(115), miss(115)]))
    expect(s.stage).toBe('NOVICE')
  })

  it('never puts isolation or machine work on NOVICE', () => {
    expect(ask(curl, weekly([[20, [12, 12, 12]], [20, [12, 12, 12]], [20, [12, 12, 12]]])).stage).toBe('EARLY_INT')
    expect(ask({ ...squat, kind: 'machine' }, weekly([ok(100), ok(100), ok(100)])).stage).toBe('EARLY_INT')
  })

  it('stays on EARLY_INT once it has left NOVICE', () => {
    // a flat spell moves it over, and a later burst of progress does not move it back
    const rows: [number, number[]][] = [...Array.from({ length: 9 }, () => ok(100)), [105, [8, 8, 8]], [110, [8, 8, 8]], [115, [8, 8, 8]]]
    expect(ask(squat, weekly(rows)).stage).toBe('EARLY_INT')
  })
})

describe('EARLY_INT stall ladder', () => {
  const calib = (): [number, number[]][] => [[20, [12, 12, 12]], [20, [12, 12, 12]], [20, [12, 12, 12]]]

  it('progresses by double progression while reps improve', () => {
    expect(ask(curl, weekly([...calib(), [20, [13, 12, 12]]]))).toMatchObject({ stage: 'EARLY_INT', rule: 'dp-hold', weight: 20 })
  })

  it('repeats on the first stall, with no rep progress at the same weight', () => {
    const s = ask(curl, weekly([...calib(), [20, [12, 12, 12]]]))
    expect(s).toMatchObject({ rule: 'stall-repeat', weight: 20 })
  })

  it('holds with a lower target on the second stall', () => {
    const s = ask(curl, weekly([...calib(), [20, [12, 12, 12]], [20, [12, 12, 12]]]))
    expect(s).toMatchObject({ rule: 'stall-lower-target', weight: 20, reps: 12 })
  })

  it('swaps or drops 5% on the third stall', () => {
    const s = ask({ ...curl, step: 1 }, weekly([...calib(), [100, [12, 12, 12]], [100, [12, 12, 12]], [100, [12, 12, 12]], [100, [12, 12, 12]]]))
    expect(s).toMatchObject({ rule: 'stall-swap', weight: 95 })
  })

  it('says the variation should change when a 5% drop is not loadable', () => {
    const s = ask(curl, weekly([...calib(), [20, [12, 12, 12]], [20, [12, 12, 12]], [20, [12, 12, 12]], [20, [12, 12, 12]]]))
    expect(s).toMatchObject({ rule: 'stall-swap', weight: 20 })
    expect(s.reason).toMatch(/not loadable/)
  })

  it('does not call a top hit, a reset or a progressed-and-in-range session a stall', () => {
    expect(ask(curl, weekly([...calib(), [20, [15, 15, 15]]])).rule).not.toMatch(/stall/)
    expect(ask(curl, weekly([...calib(), [25, [10, 10, 10]]])).rule).toBe('dp-hold')
    expect(ask(curl, weekly([...calib(), [25, [12, 12, 12]], [20, [12, 12, 12]]])).rule).not.toMatch(/stall/)
  })

  it('calls a set below the bottom of the range at a raised weight a stall', () => {
    expect(ask(curl, weekly([...calib(), [25, [9, 9, 9]]])).rule).toBe('stall-repeat')
  })

  it('goes straight to the third rung on a rep drop of 2+ at a stall', () => {
    const s = ask({ ...curl, step: 1 }, weekly([[30, [12, 11, 10]], [30, [12, 11, 10]], [30, [12, 11, 10]], [30, [12, 10, 9]]]))
    expect(s).toMatchObject({ rule: 'stall-swap', weight: 29 }) // 30 - 5% = 28.5, rounded to the 1 lb step
  })

  it('ignores a confounded stall', () => {
    const s = ask(curl, weekly([...calib(), [20, [12, 12, 12], ['ill']]]))
    expect(s.rule).toBe('stall-ignored')
  })
})
