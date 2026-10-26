<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { exerciseLabel } from '../lib/exercises'
  import { exerciseHistory, type ExerciseSession } from '../lib/history'
  import { addExerciseToSession, closeSession, setsFor, workingSets } from '../lib/sessions'
  import ExercisePicker from '../components/ExercisePicker.svelte'
  import SetLogger from '../components/SetLogger.svelte'

  let { sessionId, onclosed }: { sessionId: number; onclosed: () => void } = $props()

  const session = liveQuery(() => db.sessions.get(sessionId))
  const exercises = liveQuery(() => db.exercises.toArray())

  let currentId = $state<number | null>(null)
  let adding = $state(false)
  let history = $state<ExerciseSession[]>([])

  $effect(() => {
    const id = currentId
    history = []
    if (id !== null) exerciseHistory(id, db, { excludeSessionId: sessionId }).then((h) => (history = h))
  })

  const current = $derived($exercises?.find((e) => e.id === currentId))

  async function addExercise(id: number) {
    await addExerciseToSession(sessionId, id)
    currentId = id
    adding = false
  }

  async function close() {
    await closeSession(sessionId)
    onclosed()
  }
</script>

{#if $session}
  <div class="row">
    <div class="grow muted">{$session.type} · {$session.location}{$session.trainer ? ' · trainer' : ''}</div>
    <button class="btn" onclick={close}>Done for today</button>
  </div>

  {#if adding}
    <h2>Add Exercise</h2>
    <ExercisePicker exclude={$session.exerciseIds} onpick={addExercise} oncancel={() => (adding = false)} />
  {:else if current}
    <div class="row" style="margin-top:0.75rem">
      <h1 class="grow" style="margin:0">{exerciseLabel(current)}</h1>
    </div>
    {#key current.id}
      <SetLogger exercise={current} session={$session} {history} />
    {/key}
    <button class="btn block" style="margin-top:1rem" onclick={() => (currentId = null)}>Next Exercise ›</button>
  {:else}
    <h2>What's next?</h2>
    <div class="stack">
      {#each $session.exerciseIds as id (id)}
        {@const ex = $exercises?.find((e) => e.id === id)}
        {#if ex}
          <button class="btn" style="text-align:left" onclick={() => (currentId = id)}>
            {exerciseLabel(ex)}
            <span class="muted"> · {workingSets(setsFor($session, id)).length} sets</span>
          </button>
        {/if}
      {/each}
      <button class="btn" onclick={() => (adding = true)}>+ Add Exercise</button>
      <button class="btn primary" onclick={close}>Done for today</button>
    </div>
  {/if}
{/if}
