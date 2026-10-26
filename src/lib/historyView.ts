import type { SessionSet } from './db'
import { fmtWeight } from './units'

/**
 * One line from stored Sets only: working Sets grouped by weight ("135 lb × 10, 9, 8 · 145 lb × 8"),
 * with the number of warmups noted. Uses the current (corrected) values.
 */
export function summarizeSets(sets: SessionSet[]): string {
  const working = sets.filter((s) => !s.warmup)
  const warmups = sets.length - working.length
  const groups: { weight: number; unit: string; reps: number[] }[] = []
  for (const s of working) {
    const g = groups[groups.length - 1]
    if (g && g.weight === s.weight && g.unit === s.unit) g.reps.push(s.reps)
    else groups.push({ weight: s.weight, unit: s.unit, reps: [s.reps] })
  }
  const body = groups.map((g) => `${fmtWeight(g.weight, g.unit as 'lb' | 'kg')} × ${g.reps.join(', ')}`).join(' · ')
  const w = warmups ? `${warmups} warmup${warmups > 1 ? 's' : ''}` : ''
  return [body, w].filter(Boolean).join(' + ') || 'no sets'
}
