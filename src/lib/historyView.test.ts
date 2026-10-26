import { describe, expect, it } from 'vitest'
import type { SessionSet } from './db'
import { summarizeSets } from './historyView'

const set = (weight: number, reps: number, warmup = false, unit: 'lb' | 'kg' = 'lb'): SessionSet => ({
  id: `${weight}-${reps}-${Math.random()}`, exerciseId: 1, weight, unit, reps, warmup, at: 0,
})

describe('summarizeSets', () => {
  it('groups consecutive working sets by weight and notes warmups', () => {
    expect(summarizeSets([set(60, 10, true), set(135, 10), set(135, 9), set(145, 8)])).toBe('135 lb × 10, 9 · 145 lb × 8 + 1 warmup')
  })
  it('keeps each ramping set at its own weight', () => {
    expect(summarizeSets([set(80, 12), set(90, 12), set(80, 12)])).toBe('80 lb × 12 · 90 lb × 12 · 80 lb × 12')
  })
  it('keeps the unit each set was entered in', () => {
    expect(summarizeSets([set(10, 12, false, 'kg'), set(22, 12)])).toBe('10 kg × 12 · 22 lb × 12')
  })
  it('handles only warmups, and nothing', () => {
    expect(summarizeSets([set(45, 10, true), set(45, 10, true)])).toBe('2 warmups')
    expect(summarizeSets([])).toBe('no sets')
  })
  it('uses the corrected value', () => {
    const s = { ...set(170, 10), prev: [{ weight: 180, unit: 'lb' as const, reps: 10, at: 1 }] }
    expect(summarizeSets([s])).toBe('170 lb × 10')
  })
})
