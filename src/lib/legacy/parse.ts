import type { Equipment, SessionType, Unit } from '../db'

/** A raw file or record handed to the importer. `name` is the file name or S3 key. */
export interface LegacyInput {
  name: string
  text: string
}

export interface LegacySet {
  warmup: boolean
  weight: number
  unit: Unit
  reps: number
  note?: string
}

export interface LegacyExercise {
  name: string
  equipment?: Equipment
  note?: string
  sets: LegacySet[]
}

export interface LegacySession {
  date: string
  type: SessionType
  location: string
  trainer: boolean
  notes?: string
  exercises: LegacyExercise[]
  /** Stable across re-imports of the same content, so duplicates can be skipped. */
  key: string
  source: string
}

export interface Problem {
  source: string
  message: string
}

export interface ParseResult {
  sessions: LegacySession[]
  /** Records that could not be read at all. */
  errors: Problem[]
  /** Sets or Exercises dropped from an otherwise readable record. */
  warnings: Problem[]
}

const TYPES: SessionType[] = ['upper', 'lower', 'other']
const EQUIPMENT: Equipment[] = ['machine', 'dumbbell', 'cable', 'barbell', 'bodyweight']
const DATE_IN_NAME = /(\d{4})-(\d{2})-(\d{2})/

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase()
    if (t === 'bw' || t === 'bodyweight') return 0
    const n = Number.parseFloat(t)
    if (Number.isFinite(n)) return n
  }
}

/** Weight under any of the legacy field names. Pounds unless only kilograms are given. */
function weightOf(o: Obj): { weight: number; unit: Unit } | undefined {
  for (const k of ['weight_lb', 'weight_lbs', 'weight']) {
    const n = num(o[k])
    if (n !== undefined) return { weight: n, unit: 'lb' }
  }
  const kg = num(o.weight_kg)
  if (kg !== undefined) return { weight: kg, unit: 'kg' }
}

function repsOf(v: unknown): number[] | undefined {
  if (Array.isArray(v)) {
    const r = v.map(num)
    return r.every((x) => x !== undefined && x > 0) && r.length ? (r as number[]) : undefined
  }
  const n = num(v)
  return n !== undefined && n > 0 ? [n] : undefined
}

function isWarmup(v: unknown): boolean {
  return typeof v === 'string' && /^w(arm[\s-]?up)?$/i.test(v.trim())
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function normLocation(v: unknown): string {
  const t = (str(v) ?? 'gym').toLowerCase()
  return t === 'old gym' ? 'gym' : t
}

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function typeFromName(name: string): SessionType | undefined {
  const segs = name.toLowerCase().split(/[/\\]/)
  const i = segs.lastIndexOf('sessions')
  const folder = i >= 0 ? segs[i + 1] : undefined
  if (folder && (TYPES as string[]).includes(folder)) return folder as SessionType
  const m = segs.at(-1)?.match(/\d{4}-\d{2}-\d{2}-([a-z]+)/)
  if (m && (TYPES as string[]).includes(m[1])) return m[1] as SessionType
}

function exerciseOf(raw: unknown, source: string, warnings: Problem[]): LegacyExercise | undefined {
  if (!isObj(raw)) return void warnings.push({ source, message: 'An exercise entry was not an object and was skipped.' })
  const name = str(raw.name)
  if (!name) return void warnings.push({ source, message: 'An exercise without a name was skipped.' })
  const equipment = EQUIPMENT.find((e) => e === str(raw.equipment)?.toLowerCase())
  const exWeight = weightOf(raw)
  const sets: LegacySet[] = []
  const drop = (why: string) => warnings.push({ source, message: `${name}: ${why}` })

  const push = (weight: { weight: number; unit: Unit } | undefined, reps: number[] | undefined, warmup: boolean, note?: string) => {
    if (!weight) return drop('a set without a weight was skipped')
    if (!reps) return drop('a set without usable reps was skipped')
    for (const r of reps) sets.push({ warmup, weight: weight.weight, unit: weight.unit, reps: r, note })
  }

  if (Array.isArray(raw.sets)) {
    for (const s of raw.sets) {
      if (!isObj(s)) {
        drop('a set that was not an object was skipped')
        continue
      }
      push(weightOf(s) ?? exWeight, repsOf(s.reps) ?? repsOf(s.reps_per_side), isWarmup(s.set) || s.warmup === true, str(s.note))
    }
  } else {
    // `sets` is a count (or missing) and reps are exercise-level: a number, or one entry per set.
    const reps = repsOf(raw.reps)
    const count = num(raw.sets)
    if (!reps) drop('no reps recorded, so nothing was imported')
    else if (reps.length === 1 && count && count > 1) push(exWeight, Array(Math.floor(count)).fill(reps[0]), false)
    else push(exWeight, reps, false)
  }

  if (sets.length === 0) return void warnings.push({ source, message: `${name}: no usable sets, exercise skipped.` })
  return { name, equipment, note: str(raw.note), sets }
}

function sessionOf(raw: unknown, source: string, errors: Problem[], warnings: Problem[]): LegacySession | undefined {
  if (!isObj(raw)) return void errors.push({ source, message: 'Not a session object.' })
  const date = str(raw.date)?.replace(/\//g, '-').match(DATE_IN_NAME)?.[0] ?? source.match(DATE_IN_NAME)?.[0]
  if (!date) return void errors.push({ source, message: 'No date in the record or its file name.' })
  if (!Array.isArray(raw.exercises)) return void errors.push({ source, message: 'No exercises list.' })

  const typeRaw = str(raw.type)?.toLowerCase()
  const type = ((TYPES as string[]).includes(typeRaw ?? '') ? typeRaw : typeFromName(source)) as SessionType | undefined
  const exercises = raw.exercises.map((e) => exerciseOf(e, source, warnings)).filter((e): e is LegacyExercise => !!e)
  if (exercises.length === 0) return void errors.push({ source, message: 'No exercise had usable sets.' })

  const trainer = raw.with_trainer === true || raw.trainer === true
  const final = {
    date,
    type: type ?? 'other',
    location: normLocation(raw.location),
    trainer,
    notes: str(raw.notes),
    exercises,
  }
  return { ...final, key: `legacy:${date}:${final.type}:${hash(JSON.stringify(exercises))}`, source }
}

/** Unwraps `{ path|key, body }` records where `body` is a JSON string or an object. */
function unwrap(value: unknown, source: string): { value: unknown; source: string } {
  if (isObj(value) && 'body' in value && !('exercises' in value)) {
    const label = str(value.path) ?? str(value.key) ?? source
    const body = value.body
    if (typeof body === 'string') {
      try {
        return { value: JSON.parse(body), source: label }
      } catch {
        return { value: undefined, source: label }
      }
    }
    return { value: body, source: label }
  }
  return { value, source }
}

export function parseLegacy(inputs: LegacyInput[]): ParseResult {
  const result: ParseResult = { sessions: [], errors: [], warnings: [] }
  for (const input of inputs) {
    let json: unknown
    try {
      json = JSON.parse(input.text)
    } catch {
      result.errors.push({ source: input.name, message: 'Not valid JSON.' })
      continue
    }
    const records = Array.isArray(json) ? json : [json]
    for (const rec of records) {
      const { value, source } = unwrap(rec, input.name)
      if (value === undefined) {
        result.errors.push({ source, message: 'The record body could not be read.' })
        continue
      }
      const s = sessionOf(value, source, result.errors, result.warnings)
      if (s) result.sessions.push(s)
    }
  }
  result.sessions.sort((a, b) => a.date.localeCompare(b.date))
  return result
}
