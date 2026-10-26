import { db, type Exercise, type PainFlag, type Session } from './db'

export interface NewFlag {
  exerciseId: number
  severity: PainFlag['severity']
  action: PainFlag['action']
  bodyArea?: string
}

export async function raiseFlag(flag: NewFlag, store = db, now = Date.now()): Promise<number> {
  return (await store.painFlags.add({ ...flag, createdAt: now })) as number
}

export async function resolveFlag(id: number, store = db, now = Date.now()): Promise<void> {
  await store.painFlags.update(id, { resolvedAt: now })
}

export async function openFlags(store = db): Promise<PainFlag[]> {
  const all = await store.painFlags.toArray()
  return all.filter((f) => f.resolvedAt === undefined).sort((a, b) => b.createdAt - a.createdAt)
}

/** Body areas an Exercise loads: its main muscle plus the joints it is tagged with. */
export function areasOf(ex: Pick<Exercise, 'muscle' | 'bodyAreas'>): string[] {
  return [...(ex.muscle ? [ex.muscle] : []), ...ex.bodyAreas]
}

/** Open flags that apply to an Exercise: its own, or ones on a body area it shares. */
export function flagsRelevantTo(ex: Exercise, flags: PainFlag[]): PainFlag[] {
  const areas = areasOf(ex)
  return flags.filter(
    (f) => f.resolvedAt === undefined && (f.exerciseId === ex.id || (f.bodyArea !== undefined && areas.includes(f.bodyArea))),
  )
}

/** A sharp flag marked "stop", raised during this Session, means stop that movement today. */
export function stoppedInSession(exerciseId: number, session: Session, flags: PainFlag[]): boolean {
  return flags.some(
    (f) => f.exerciseId === exerciseId && f.severity === 'sharp' && f.action === 'stop' && f.createdAt >= session.startedAt,
  )
}
