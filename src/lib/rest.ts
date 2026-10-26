import type { Routine, RestCategory, Session, SessionSet } from './db'
import { REST_SECONDS } from './exercises'

export interface RestTimer {
  startedAt: number
  total: number
}

export interface RestView {
  /** Seconds left; 0 once the target has passed. */
  left: number
  /** Whole seconds since the Set was logged. */
  elapsed: number
  done: boolean
}

export function restView(t: RestTimer, now: number): RestView {
  const elapsed = Math.max(0, Math.floor((now - t.startedAt) / 1000))
  return { left: Math.max(0, t.total - elapsed), elapsed, done: elapsed >= t.total }
}

export function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

/**
 * True when the Set just logged was the last working Set of the last Exercise in the Routine.
 * Needs a Routine entry for the Exercise; without one the end of the workout is unknown.
 */
export function isFinalSet(session: Session, routine: Routine | undefined, exerciseId: number): boolean {
  if (!routine) return false
  const last = routine.entries.at(-1)
  if (!last || last.exerciseId !== exerciseId) return false
  const done = session.sets.filter((s) => s.exerciseId === exerciseId && !s.warmup).length
  return done >= last.targetSets
}

/**
 * Rest starts after a working Set. It is skipped for warmups, the final Set of the workout,
 * and when the Session's timer is off (trainer Sessions default to off; turning it on is asking).
 */
export function restFor(
  session: Session,
  routine: Routine | undefined,
  set: Pick<SessionSet, 'exerciseId' | 'warmup'>,
  category: RestCategory,
): number | null {
  if (set.warmup || !session.timer) return null
  if (isFinalSet(session, routine, set.exerciseId)) return null
  return REST_SECONDS[category]
}
