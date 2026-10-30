<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { exerciseLabel } from '../lib/exercises'
  import { setsFor } from '../lib/sessions'
  import SetRow from './SetRow.svelte'

  let { sessionId, ondone }: { sessionId: number; ondone: () => void } = $props()

  const data = liveQuery(async () => ({
    session: await db.sessions.get(sessionId),
    exercises: await db.exercises.toArray(),
  }))
</script>

{#if $data?.session}
  {@const s = $data.session}
  <h1>Session done</h1>
  <p class="text-base-content/60 text-sm">{s.date} · {s.type} · {s.location}{s.trainer ? ' · trainer' : ''}</p>
  <div class="grid grid-cols-1 gap-3">
    {#each s.exerciseIds as id (id)}
      {@const ex = $data.exercises.find((e) => e.id === id)}
      {@const sets = setsFor(s, id)}
      {#if sets.length}
        <div class="card card-border bg-base-100 p-4">
          <strong>{ex ? exerciseLabel(ex) : 'Exercise'}</strong>
          {#each sets as x (x.id)}
            {#if ex}<SetRow set={x} sessionId={s.id!} exercise={ex} label={x.warmup ? 'Warmup' : 'Set'} />{/if}
          {/each}
        </div>
      {/if}
    {:else}
      <p class="text-base-content/60 text-sm">No sets were logged.</p>
    {/each}
    <button class="btn btn-primary btn-block" onclick={ondone}>Back to Today</button>
  </div>
{/if}
