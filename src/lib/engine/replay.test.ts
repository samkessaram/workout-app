import { describe, expect, it } from 'vitest'
import { parseLegacy } from '../legacy/parse'
import { formatReplay, replay } from './replay'
import { suggest } from './suggest'

const day = (n: number) => `2026-01-${String(n).padStart(2, '0')}`
const rec = (n: number, w: number, reps: number[]) => ({
  name: `${day(n)}.json`,
  text: JSON.stringify({ date: day(n), type: 'lower', exercises: [{ name: 'Leg Press', equipment: 'machine', sets: reps.map((r) => ({ weight_lb: w, reps: r })) }] }),
})
const load = (...rows: [number, number, number[]][]) => parseLegacy(rows.map(([n, w, r]) => rec(n, w, r))).sessions

describe('replay harness', () => {
  it('computes each Suggestion from only the Sessions before it, using the real engine', () => {
    const sessions = load([1, 100, [12, 12, 12]], [2, 100, [12, 12, 12]], [3, 100, [12, 12, 12]], [4, 105, [10, 10, 10]])
    const { rows } = replay(sessions)
    expect(rows.map((r) => r.rule)).toEqual(['no-history', 'calibration', 'calibration', 'dp-increase'])
    expect(rows[0].suggested.weight).toBeNull()
    expect(rows[3]).toMatchObject({ suggested: { weight: 105, reps: 8 }, actual: { weight: 105, reps: [10, 10, 10] }, delta: 0, flagged: false })
    // the same call the app makes, on the same prefix of history, gives the same answer
    const direct = suggest({
      exercise: { kind: 'machine', step: 5, stepUnit: 'lb', repMin: 8, repMax: 12 },
      history: [1, 2, 3].map((n) => ({ sessionId: n, date: day(n), startedAt: n, location: 'gym', chips: [], sets: [12, 12, 12].map((reps) => ({ weight: 100, unit: 'lb' as const, reps, warmup: false })) })),
      unit: 'lb',
    })
    expect(rows[3].suggested.weight).toBe(direct.weight)
  })

  it('flags large disagreements and tallies them', () => {
    const sessions = load([1, 100, [12, 12, 12]], [2, 100, [12, 12, 12]], [3, 100, [12, 12, 12]], [4, 130, [8, 8, 8]], [5, 100, [10, 10, 10]])
    const { rows, summary } = replay(sessions)
    expect(rows[3]).toMatchObject({ flagged: true })
    expect(rows[3].delta).toBeCloseTo((130 - 105) / 105)
    expect(summary).toMatchObject({ rows: 5, noSuggestion: 1, flagged: 2, above: 1, below: 1 })
    expect(summary.byRule['dp-increase']).toEqual({ rows: 1, flagged: 1 })
  })

  it('prints a table with a review marker and a summary', () => {
    const { rows, summary } = replay(load([1, 100, [12, 12, 12]], [2, 100, [12, 12, 12]], [3, 100, [12, 12, 12]], [4, 140, [8, 8, 8]]))
    const out = formatReplay(rows, summary)
    expect(out).toMatch(/Leg Press/)
    expect(out).toMatch(/<-- review/)
    expect(out).toMatch(/4 exposures replayed/)
  })

  it('skips Sessions with no working sets', () => {
    const only = parseLegacy([{ name: 'a.json', text: JSON.stringify({ date: day(1), type: 'lower', exercises: [{ name: 'Leg Press', sets: [{ set: 'warmup', weight: 50, reps: 10 }] }] }) }])
    expect(replay(only.sessions).rows).toEqual([])
  })
})
