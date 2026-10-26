<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { exerciseLabel, listExercises, newExercise } from '../lib/exercises'
  import { prefs } from '../lib/settings.svelte'
  import ExerciseForm from './ExerciseForm.svelte'

  let {
    exclude = [],
    onpick,
    oncancel,
  }: { exclude?: number[]; onpick: (id: number) => void; oncancel?: () => void } = $props()

  const exercises = liveQuery(() => listExercises(db))
  let creating = $state(false)
</script>

{#if creating}
  <h2>New Exercise</h2>
  <ExerciseForm exercise={newExercise(prefs.unit)} ondone={() => (creating = false)} />
{:else}
  <div class="stack">
    {#each ($exercises ?? []).filter((e) => !exclude.includes(e.id!)) as e (e.id)}
      <button class="btn" style="text-align:left" onclick={() => onpick(e.id!)}>{exerciseLabel(e)}</button>
    {:else}
      <p class="muted">No Exercises to add yet.</p>
    {/each}
    <button class="btn" onclick={() => (creating = true)}>+ New Exercise</button>
    {#if oncancel}<button class="btn" onclick={oncancel}>Cancel</button>{/if}
  </div>
{/if}
