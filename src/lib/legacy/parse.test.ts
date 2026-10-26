import { describe, expect, it } from 'vitest'
import { parseLegacy } from './parse'

const parse = (name: string, value: unknown) => parseLegacy([{ name, text: typeof value === 'string' ? value : JSON.stringify(value) }])
const sets = (r: ReturnType<typeof parse>, ex = 0) => r.sessions[0].exercises[ex].sets.map((s) => [s.weight, s.unit, s.reps, s.warmup])

describe('legacy parser (synthetic fixtures)', () => {
  it('reads the current format, with ramping sets kept separate and warmups flagged', () => {
    const r = parse('sessions/lower/2026-01-05-lower.json', {
      date: '2026-01-05', type: 'lower', location: 'new gym', with_trainer: true, notes: 'good day',
      exercises: [{ name: 'Leg Press', equipment: 'machine', note: 'new stack', sets: [
        { set: 'warmup', weight_lb: 50, reps: 12 },
        { set: 1, weight_lb: 80, reps: 12 },
        { set: 2, weight_lb: 90, reps: 12, note: 'smooth' },
      ] }],
    })
    expect(r.errors).toEqual([])
    expect(r.sessions[0]).toMatchObject({ date: '2026-01-05', type: 'lower', location: 'new gym', trainer: true })
    expect(sets(r)).toEqual([[50, 'lb', 12, true], [80, 'lb', 12, false], [90, 'lb', 12, false]])
    expect(r.sessions[0].exercises[0]).toMatchObject({ equipment: 'machine', note: 'new stack' })
  })

  it('reads weight, weight_lbs and weight_kg', () => {
    const r = parse('x.json', { date: '2026-01-05', type: 'upper', exercises: [
      { name: 'A', sets: [{ weight: 100, reps: 8 }] },
      { name: 'B', sets: [{ weight_lbs: 110, reps: 8 }] },
      { name: 'C', sets: [{ weight_kg: 10, reps: 8 }] },
      { name: 'D', sets: [{ weight: '45', reps: '8' }] },
    ] })
    expect([0, 1, 2, 3].map((i) => sets(r, i)[0])).toEqual([[100, 'lb', 8, false], [110, 'lb', 8, false], [10, 'kg', 8, false], [45, 'lb', 8, false]])
  })

  it('reads reps as arrays and sets as a count', () => {
    const r = parse('x.json', { date: '2026-01-05', type: 'upper', exercises: [
      { name: 'Bench', sets: 3, weight: 135, reps: [10, 8, 8] },
      { name: 'Row', sets: 3, weight_lbs: 100, reps: 10 },
      { name: 'Curl', weight: 30, reps: [12, 10] },
      { name: 'Press', sets: [{ weight: 60, reps: [10, 9] }] },
    ] })
    expect(sets(r, 0).map((s) => s[2])).toEqual([10, 8, 8])
    expect(sets(r, 1)).toEqual([[100, 'lb', 10, false], [100, 'lb', 10, false], [100, 'lb', 10, false]])
    expect(sets(r, 2).map((s) => s[2])).toEqual([12, 10])
    expect(sets(r, 3)).toEqual([[60, 'lb', 10, false], [60, 'lb', 9, false]])
  })

  it('takes the date and type from the file name when the record lacks them', () => {
    const r = parse('sessions/2026-02-03-lower.json', { exercises: [{ name: 'Squat', sets: [{ weight: 100, reps: 5 }] }] })
    expect(r.sessions[0]).toMatchObject({ date: '2026-02-03', type: 'lower' })
    const folder = parse('sessions/rowing/2026-02-04.json', { exercises: [{ name: 'Erg', sets: [{ weight: 0, reps: 1 }] }] })
    expect(folder.sessions[0]).toMatchObject({ date: '2026-02-04', type: 'rowing' })
  })

  it('unwraps records whose body is a JSON string, and arrays of sessions', () => {
    const body = JSON.stringify({ date: '2026-03-01', type: 'upper', exercises: [{ name: 'A', sets: [{ weight: 1, reps: 1 }] }] })
    const r = parseLegacy([
      { name: 'dump.json', text: JSON.stringify([{ path: 'sessions/upper/2026-03-01-upper.json', body }, { key: 'k', body: JSON.parse(body) }]) },
    ])
    expect(r.sessions).toHaveLength(2)
    expect(r.errors).toEqual([])
    expect(r.sessions[0].source).toBe('sessions/upper/2026-03-01-upper.json')
  })

  it('reports unreadable records and dropped sets instead of silently skipping them', () => {
    const r = parseLegacy([
      { name: 'bad.json', text: '{nope' },
      { name: 'nodate.json', text: JSON.stringify({ exercises: [] }) },
      { name: 'noex.json', text: JSON.stringify({ date: '2026-01-01' }) },
      { name: 'badbody.json', text: JSON.stringify({ path: 'p', body: '{nope' }) },
      { name: 'partial.json', text: JSON.stringify({ date: '2026-01-02', type: 'upper', exercises: [
        { name: 'Good', sets: [{ weight: 10, reps: 5 }, { weight: 10 }, { reps: 5 }, 'junk'] },
        { name: '', sets: [] },
        { name: 'Empty', sets: [{ weight: 10 }] },
      ] }) },
    ])
    expect(r.errors.map((e) => e.source).sort()).toEqual(['bad.json', 'noex.json', 'nodate.json', 'p'].sort())
    expect(r.sessions).toHaveLength(1)
    expect(sets(r)).toEqual([[10, 'lb', 5, false]])
    expect(r.warnings.length).toBeGreaterThanOrEqual(5)
  })

  it('normalises locations and gives identical content the same key', () => {
    const rec = { date: '2026-01-05', type: 'upper', location: 'old gym', exercises: [{ name: 'A', sets: [{ weight: 1, reps: 1 }] }] }
    const a = parse('one.json', rec)
    const b = parse('two/elsewhere.json', rec)
    expect(a.sessions[0].location).toBe('gym')
    expect(a.sessions[0].key).toBe(b.sessions[0].key)
    const c = parse('one.json', { ...rec, exercises: [{ name: 'A', sets: [{ weight: 2, reps: 1 }] }] })
    expect(c.sessions[0].key).not.toBe(a.sessions[0].key)
  })

  it('sorts oldest first and defaults an unknown type to other', () => {
    const r = parseLegacy([
      { name: 'b.json', text: JSON.stringify({ date: '2026-02-01', type: 'yoga', exercises: [{ name: 'A', sets: [{ weight: 1, reps: 1 }] }] }) },
      { name: 'a.json', text: JSON.stringify({ date: '2026-01-01', type: 'upper', exercises: [{ name: 'A', sets: [{ weight: 1, reps: 1 }] }] }) },
    ])
    expect(r.sessions.map((s) => s.date)).toEqual(['2026-01-01', '2026-02-01'])
    expect(r.sessions[1].type).toBe('other')
  })
})
