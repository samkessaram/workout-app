<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db, type Exercise } from '../lib/db'
  import { exerciseLabel, listExercises, newExercise } from '../lib/exercises'
  import { prefs } from '../lib/settings.svelte'
  import { fmtWeight } from '../lib/units'
  import ExerciseForm from '../components/ExerciseForm.svelte'

  let { onback }: { onback: () => void } = $props()

  const exercises = liveQuery(() => listExercises(db))
  let editing = $state<Exercise | null>(null)
</script>

{#if editing}
  <h1>{editing.id ? 'Edit Exercise' : 'New Exercise'}</h1>
  <ExerciseForm exercise={editing} ondone={() => (editing = null)} />
{:else}
  <div class="row">
    <button class="btn" onclick={onback}>‹ Settings</button>
    <h1 class="grow" style="margin:0">Exercises</h1>
  </div>
  <div class="stack" style="margin-top:1rem">
    <button class="btn primary block" onclick={() => (editing = newExercise(prefs.unit))}>+ New Exercise</button>
    {#each $exercises ?? [] as e (e.id)}
      <button class="card" style="text-align:left" onclick={() => (editing = e)}>
        <div>{exerciseLabel(e)}</div>
        <div class="muted">
          {e.repMin}-{e.repMax} reps · jump {fmtWeight(e.step, e.stepUnit)} · {e.restCategory} rest
        </div>
      </button>
    {:else}
      <p class="muted">No Exercises yet.</p>
    {/each}
  </div>
{/if}
