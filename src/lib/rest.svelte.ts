import { getSetting, setSetting } from './settings.svelte'
import type { RestTimer } from './rest'

export const rest = $state<{ timer: RestTimer | null }>({ timer: null })

export async function loadRest() {
  rest.timer = await getSetting<RestTimer | null>('restTimer', null)
}

export function startRest(total: number, now = Date.now()) {
  rest.timer = { startedAt: now, total }
  // IndexedDB cannot clone a reactive proxy, so persist a plain copy.
  void setSetting('restTimer', { startedAt: now, total })
}

export function clearRest() {
  rest.timer = null
  void setSetting('restTimer', null)
}
