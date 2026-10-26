import { db, SCHEMA_VERSION } from './db'
import { getSetting, setSetting } from './settings.svelte'

export const NUDGE_AFTER_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000
/** Settings that describe this install rather than the lifter's data. */
const TRANSIENT_SETTINGS = ['restTimer']

const TABLES = ['exercises', 'routines', 'sessions', 'painFlags', 'suggestionLog', 'settings'] as const

export interface BackupFile {
  app: 'workout'
  schemaVersion: number
  exportedAt: string
  data: Record<(typeof TABLES)[number], unknown[]>
}

export async function exportAll(store = db, now = Date.now()): Promise<BackupFile> {
  const data = {} as BackupFile['data']
  for (const t of TABLES) data[t] = await store.table(t).toArray()
  data.settings = (data.settings as { key: string }[]).filter((s) => !TRANSIENT_SETTINGS.includes(s.key))
  return { app: 'workout', schemaVersion: SCHEMA_VERSION, exportedAt: new Date(now).toISOString(), data }
}

export function parseBackup(text: string): BackupFile {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const f = json as Partial<BackupFile>
  if (!f || f.app !== 'workout' || typeof f.schemaVersion !== 'number' || !f.data) {
    throw new Error('That file is not a Workout backup.')
  }
  if (f.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `This backup is from a newer version of the app (schema ${f.schemaVersion}, this app understands ${SCHEMA_VERSION}). Update the app and try again.`,
    )
  }
  for (const t of TABLES) {
    if (!Array.isArray(f.data[t])) throw new Error(`The backup is missing its ${t} data.`)
  }
  return f as BackupFile
}

/** Replaces everything in the database with the backup's contents. */
export async function importAll(text: string, store = db): Promise<void> {
  const file = parseBackup(text)
  await store.transaction('rw', store.tables, async () => {
    for (const t of TABLES) {
      await store.table(t).clear()
      await store.table(t).bulkPut(file.data[t])
    }
  })
}

export async function markExported(store = db, now = Date.now()) {
  await setSetting('lastExportAt', now, store)
}

export async function ensureFirstRun(store = db, now = Date.now()) {
  if ((await getSetting<number | null>('firstRunAt', null, store)) === null) await setSetting('firstRunAt', now, store)
}

/** True when it has been 14+ days since the last export (or since first run if never exported). */
export async function backupNudge(store = db, now = Date.now()): Promise<boolean> {
  const last = await getSetting<number | null>('lastExportAt', null, store)
  const since = last ?? (await getSetting<number | null>('firstRunAt', null, store))
  if (since === null) return false
  return now - since >= NUDGE_AFTER_DAYS * DAY_MS
}

export function backupFilename(now = new Date()): string {
  return `workout-backup-${now.toLocaleDateString('en-CA')}.json`
}

export function saveFile(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
