<script lang="ts">
  import { onMount } from 'svelte'
  import { loadPrefs } from './lib/settings.svelte'
  import { ensureFirstRun, requestPersistence } from './lib/backup'
  import { clearRest, loadRest } from './lib/rest.svelte'
  import { autoCloseStale } from './lib/sessions'
  import Today from './screens/Today.svelte'
  import History from './screens/History.svelte'
  import Routines from './screens/Routines.svelte'
  import Settings from './screens/Settings.svelte'

  const tabs = [
    { id: 'today', label: 'Today', screen: Today },
    { id: 'history', label: 'History', screen: History },
    { id: 'routines', label: 'Routines', screen: Routines },
    { id: 'settings', label: 'Settings', screen: Settings },
  ] as const

  let active = $state<(typeof tabs)[number]['id']>('today')
  const Screen = $derived(tabs.find((t) => t.id === active)!.screen)

  // Stale Sessions must close before Today looks for an open one.
  let ready = $state(false)
  onMount(async () => {
    if ((await autoCloseStale()).length) clearRest()
    await ensureFirstRun()
    void requestPersistence()
    await loadPrefs()
    await loadRest()
    ready = true
  })
</script>

<main>{#if ready}<Screen />{:else}<div class="flex justify-center p-10"><span class="loading loading-spinner loading-lg"></span></div>{/if}</main>

<nav class="dock dock-lg" aria-label="Main">
  {#each tabs as t}
    <button class:dock-active={active === t.id} aria-current={active === t.id ? 'page' : undefined} onclick={() => (active = t.id)}>
      <span class="dock-label">{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  main {
    height: 100%;
    overflow-y: auto;
    padding: 1rem 1rem calc(5.5rem + env(safe-area-inset-bottom));
  }
</style>
