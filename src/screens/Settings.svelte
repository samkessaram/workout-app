<script lang="ts">
  import { prefs, setUnit } from '../lib/settings.svelte'
  import ExerciseLibrary from './ExerciseLibrary.svelte'

  let view = $state<'main' | 'exercises'>('main')
</script>

{#if view === 'exercises'}
  <ExerciseLibrary onback={() => (view = 'main')} />
{:else}
<h1>Settings</h1>

<section>
  <h2>Exercises</h2>
  <button class="btn block" onclick={() => (view = 'exercises')}>Manage Exercises ›</button>
</section>

<section>
  <h2>Units</h2>
  <div class="seg" role="radiogroup" aria-label="Weight unit">
    {#each ['lb', 'kg'] as const as u}
      <button
        role="radio"
        aria-checked={prefs.unit === u}
        class:on={prefs.unit === u}
        onclick={() => setUnit(u)}>{u}</button>
    {/each}
  </div>
  <p class="muted">Changes display and input only. Logged weights keep the unit they were entered in.</p>
</section>
{/if}

<style>
  .seg { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .seg button {
    min-height: var(--tap);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .seg button.on { background: var(--accent); color: var(--accent-text); border-color: var(--accent); font-weight: 600; }
  .muted { color: var(--muted); font-size: 0.9rem; }
</style>
