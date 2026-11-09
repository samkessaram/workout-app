import { db, type Unit } from './db'

export async function getSetting<T>(key: string, fallback: T, store = db): Promise<T> {
  const row = await store.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown, store = db): Promise<void> {
  await store.settings.put({ key, value })
}

export type Theme = 'system' | 'light' | 'dark'

export const prefs = $state<{ unit: Unit; theme: Theme; customChips: string[]; loaded: boolean }>({
  unit: 'lb',
  theme: 'system',
  customChips: [],
  loaded: false,
})

// 'system' drops data-theme so daisyUI falls back to prefers-color-scheme.
// The localStorage mirror lets index.html apply the theme before the DB loads.
function applyTheme(theme: Theme): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem('theme', theme)
  } catch {}
}

export async function loadPrefs(): Promise<void> {
  prefs.unit = await getSetting<Unit>('unit', 'lb')
  prefs.theme = await getSetting<Theme>('theme', 'system')
  applyTheme(prefs.theme)
  prefs.customChips = await getSetting<string[]>('customChips', [])
  prefs.loaded = true
}

export async function setUnit(unit: Unit): Promise<void> {
  prefs.unit = unit
  await setSetting('unit', unit)
}

export async function setTheme(theme: Theme): Promise<void> {
  prefs.theme = theme
  applyTheme(theme)
  await setSetting('theme', theme)
}

export async function setCustomChips(chips: string[]): Promise<void> {
  prefs.customChips = chips
  await setSetting('customChips', chips)
}
