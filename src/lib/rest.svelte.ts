import { getSetting, setSetting } from './settings.svelte'
import type { RestTimer } from './rest'

export const rest = $state<{ timer: RestTimer | null }>({ timer: null })

export async function loadRest() {
  rest.timer = await getSetting<RestTimer | null>('restTimer', null)
}

export function startRest(total: number, now = Date.now()) {
  rest.timer = { startedAt: now, total }
  void setSetting('restTimer', rest.timer)
}

export function clearRest() {
  rest.timer = null
  void setSetting('restTimer', null)
}
