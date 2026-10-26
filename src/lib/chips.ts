import { db } from './db'

export const NOTE_CHIPS = [
  'tight hips',
  'shaky',
  'form broke down',
  'left side failed first',
  'right side failed first',
  'felt easy',
  'felt heavy',
]

/** Reasons a missed target says nothing about progress. Stalls carrying one do not count. */
export const CONFOUNDER_CHIPS = ['poor sleep', 'ill', 'travel', 'missed food', 'injury']

export function isConfounder(chip: string): boolean {
  return CONFOUNDER_CHIPS.includes(chip)
}

export function hasConfounder(chips: string[]): boolean {
  return chips.some(isConfounder)
}

export function allChips(custom: string[]): string[] {
  return [...NOTE_CHIPS, ...CONFOUNDER_CHIPS, ...custom]
}

export function normalizeChip(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Returns the new custom chip list, or the same list when the chip is empty or already exists. */
export function withCustomChip(custom: string[], text: string): string[] {
  const chip = normalizeChip(text)
  if (!chip || allChips(custom).includes(chip)) return custom
  return [...custom, chip]
}

function toggled(list: string[] | undefined, chip: string): string[] {
  const cur = list ?? []
  return cur.includes(chip) ? cur.filter((c) => c !== chip) : [...cur, chip]
}

async function edit(sessionId: number, fn: (s: import('./db').Session) => void, store: typeof db) {
  await store.transaction('rw', store.sessions, async () => {
    const s = await store.sessions.get(sessionId)
    if (!s) throw new Error(`Session ${sessionId} not found`)
    fn(s)
    await store.sessions.put(s)
  })
}

export async function toggleSetChip(sessionId: number, setId: string, chip: string, store = db) {
  await edit(sessionId, (s) => {
    const set = s.sets.find((x) => x.id === setId)
    if (!set) throw new Error('Set not found')
    set.chips = toggled(set.chips, chip)
  }, store)
}

export async function setSetNote(sessionId: number, setId: string, note: string, store = db) {
  await edit(sessionId, (s) => {
    const set = s.sets.find((x) => x.id === setId)
    if (!set) throw new Error('Set not found')
    set.note = note.trim() || undefined
  }, store)
}

export async function toggleExerciseChip(sessionId: number, exerciseId: number, chip: string, store = db) {
  await edit(sessionId, (s) => {
    s.exerciseChips = { ...s.exerciseChips, [exerciseId]: toggled(s.exerciseChips?.[exerciseId], chip) }
  }, store)
}

export async function setExerciseNote(sessionId: number, exerciseId: number, note: string, store = db) {
  await edit(sessionId, (s) => {
    s.exerciseNotes = { ...s.exerciseNotes, [exerciseId]: note.trim() }
    if (!s.exerciseNotes[exerciseId]) delete s.exerciseNotes[exerciseId]
  }, store)
}
