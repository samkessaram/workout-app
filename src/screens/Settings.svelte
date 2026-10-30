<script lang="ts">
  import { prefs, setUnit } from '../lib/settings.svelte'
  import BackupNudge from '../components/BackupNudge.svelte'
  import Backup from './Backup.svelte'
  import LegacyImport from './LegacyImport.svelte'
  import ChipSettings from './ChipSettings.svelte'
  import ExerciseLibrary from './ExerciseLibrary.svelte'

  let view = $state<'main' | 'exercises' | 'chips' | 'backup' | 'legacy'>('main')
</script>

{#if view === 'exercises'}
  <ExerciseLibrary onback={() => (view = 'main')} />
{:else if view === 'legacy'}
  <LegacyImport onback={() => (view = 'main')} />
{:else if view === 'backup'}
  <Backup onback={() => (view = 'main')} />
{:else if view === 'chips'}
  <ChipSettings onback={() => (view = 'main')} />
{:else}
<h1>Settings</h1>
<BackupNudge onopen={() => (view = 'backup')} />

<section>
  <h2>Exercises</h2>
  <button class="btn btn-block" onclick={() => (view = 'exercises')}>Manage Exercises ›</button>
</section>

<section>
  <h2>Notes</h2>
  <button class="btn btn-block" onclick={() => (view = 'chips')}>Custom note chips ›</button>
</section>

<section>
  <h2>Data</h2>
  <div class="grid grid-cols-1 gap-3">
    <button class="btn btn-block" onclick={() => (view = 'backup')}>Export / restore ›</button>
    <button class="btn btn-block" onclick={() => (view = 'legacy')}>Import old S3 history ›</button>
  </div>
</section>

<section>
  <h2>Units</h2>
  <div class="join w-full" role="radiogroup" aria-label="Weight unit">
    {#each ['lb', 'kg'] as const as u}
      <button
        role="radio"
        class="btn join-item flex-1"
        aria-checked={prefs.unit === u}
        class:btn-primary={prefs.unit === u}
        onclick={() => setUnit(u)}>{u}</button>
    {/each}
  </div>
  <p class="text-base-content/60 text-sm">Changes display and input only. Logged weights keep the unit they were entered in.</p>
</section>
{/if}
