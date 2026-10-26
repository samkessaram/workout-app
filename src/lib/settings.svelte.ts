import { db, type Unit } from './db'

export async function getSetting<T>(key: string, fallback: T, store = db): Promise<T> {
  const row = await store.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown, store = db): Promise<void> {
  await store.settings.put({ key, value })
}

export const prefs = $state<{ unit: Unit; customChips: string[]; loaded: boolean }>({
  unit: 'lb',
  customChips: [],
  loaded: false,
})

export async function loadPrefs(): Promise<void> {
  prefs.unit = await getSetting<Unit>('unit', 'lb')
  prefs.customChips = await getSetting<string[]>('customChips', [])
  prefs.loaded = true
}

export async function setUnit(unit: Unit): Promise<void> {
  prefs.unit = unit
  await setSetting('unit', unit)
}

export async function setCustomChips(chips: string[]): Promise<void> {
  prefs.customChips = chips
  await setSetting('customChips', chips)
}
