import { confoundersIn } from '../legacy/import'
import { draftExercise, itemId } from '../legacy/map'
import type { LegacySession } from '../legacy/parse'
import type { Unit } from '../db'
import { toExposures } from './exposure'
import { suggest } from './suggest'
import type { EngineSession, Stage } from './types'

/** A Suggestion further than this from what was lifted is flagged for the lifter to look at. */
export const FLAG_DELTA = 0.1

export interface ReplayRow {
  date: string
  exercise: string
  stage: Stage
  rule: string
  reason: string
  suggested: { weight: number | null; reps: number }
  actual: { weight: number; reps: number[] }
  /** (actual - suggested) / suggested, or null when no weight was suggested. */
  delta: number | null
  flagged: boolean
}

export interface ReplaySummary {
  rows: number
  followed: number
  above: number
  below: number
  noSuggestion: number
  flagged: number
  byRule: Record<string, { rows: number; flagged: number }>
}

/**
 * Replays history Session by Session. Each Suggestion is computed with the real engine from
 * only the Sessions before it, then set beside what was actually lifted.
 * Exercise kind is guessed from names here (the app lets the lifter set it), so treat the
 * stage and step columns as approximate.
 */
export function replay(sessions: LegacySession[], unit: Unit = 'lb'): { rows: ReplayRow[]; summary: ReplaySummary } {
  const byExercise = new Map<string, { name: string; equipment?: LegacySession['exercises'][number]['equipment']; sessions: EngineSession[] }>()
  let n = 0
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of s.exercises) {
      const id = itemId(e.name, e.equipment)
      const entry = byExercise.get(id) ?? { name: e.name, equipment: e.equipment, sessions: [] }
      const sessionChips = confoundersIn(s.notes)
      const chips = [...new Set([...sessionChips, ...confoundersIn(e.note), ...e.sets.flatMap((x) => confoundersIn(x.note))])]
      entry.sessions.push({
        sessionId: ++n,
        date: s.date,
        startedAt: new Date(`${s.date}T12:00:00`).getTime() + n,
        location: s.location,
        chips,
        sets: e.sets.map((x) => ({ weight: x.weight, unit: x.unit, reps: x.reps, warmup: x.warmup })),
      })
      byExercise.set(id, entry)
    }
  }

  const rows: ReplayRow[] = []
  for (const { name, equipment, sessions: history } of byExercise.values()) {
    const exercise = draftExercise(name, equipment, history[0]?.sets[0]?.unit ?? unit)
    for (let i = 0; i < history.length; i++) {
      const actual = toExposures([history[i]], exercise, unit)[0]
      if (!actual) continue
      const s = suggest({ exercise, history: history.slice(0, i), unit })
      const delta = s.weight ? (actual.weight - s.weight) / s.weight : null
      rows.push({
        date: history[i].date,
        exercise: name,
        stage: s.stage,
        rule: s.rule,
        reason: s.reason,
        suggested: { weight: s.weight, reps: s.reps },
        actual: { weight: actual.weight, reps: actual.reps },
        delta,
        flagged: delta !== null && Math.abs(delta) >= FLAG_DELTA,
      })
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.exercise.localeCompare(b.exercise))

  const summary: ReplaySummary = { rows: rows.length, followed: 0, above: 0, below: 0, noSuggestion: 0, flagged: 0, byRule: {} }
  for (const r of rows) {
    const by = (summary.byRule[r.rule] ??= { rows: 0, flagged: 0 })
    by.rows++
    if (r.flagged) {
      by.flagged++
      summary.flagged++
    }
    if (r.delta === null) summary.noSuggestion++
    else if (r.delta > 0.001) summary.above++
    else if (r.delta < -0.001) summary.below++
    else summary.followed++
  }
  return { rows, summary }
}

const fmt = (w: number | null, unit: Unit) => (w === null ? '—' : `${Math.round(w * 100) / 100}${unit}`)

export function formatReplay(rows: ReplayRow[], summary: ReplaySummary, unit: Unit = 'lb'): string {
  const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))
  const lines = [
    `${pad('date', 11)}${pad('exercise', 28)}${pad('stage', 12)}${pad('rule', 18)}${pad('suggested', 14)}${pad('actual', 22)}delta`,
  ]
  for (const r of rows) {
    const sug = `${fmt(r.suggested.weight, unit)} x ${r.suggested.reps}`
    const act = `${fmt(r.actual.weight, unit)} x ${r.actual.reps.join('/')}`
    const d = r.delta === null ? '' : `${r.delta > 0 ? '+' : ''}${(r.delta * 100).toFixed(0)}%`
    lines.push(`${pad(r.date, 11)}${pad(r.exercise.slice(0, 26), 28)}${pad(r.stage, 12)}${pad(r.rule, 18)}${pad(sug, 14)}${pad(act, 22)}${d}${r.flagged ? '  <-- review' : ''}`)
  }
  lines.push('')
  lines.push(
    `${summary.rows} exposures replayed: ${summary.followed} matched the Suggestion, ${summary.above} above, ${summary.below} below, ${summary.noSuggestion} had no weight to suggest. ${summary.flagged} flagged (>= ${FLAG_DELTA * 100}% off).`,
  )
  for (const [rule, v] of Object.entries(summary.byRule)) lines.push(`  ${pad(rule, 14)} ${v.rows} rows, ${v.flagged} flagged`)
  return lines.join('\n')
}
