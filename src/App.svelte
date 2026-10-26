<script lang="ts">
  import { onMount } from 'svelte'
  import { loadPrefs } from './lib/settings.svelte'
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

  onMount(loadPrefs)
</script>

<main><Screen /></main>

<nav aria-label="Main">
  {#each tabs as t}
    <button aria-current={active === t.id ? 'page' : undefined} onclick={() => (active = t.id)}>
      {t.label}
    </button>
  {/each}
</nav>

<style>
  main {
    height: calc(100% - var(--tap) - env(safe-area-inset-bottom));
    overflow-y: auto;
    padding: 1rem;
  }
  nav {
    position: fixed;
    inset: auto 0 0 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
  }
  nav button {
    min-height: var(--tap);
    background: none;
    border: 0;
    color: var(--muted);
    font-size: 0.85rem;
  }
  nav button[aria-current='page'] { color: var(--accent); font-weight: 600; }
</style>
