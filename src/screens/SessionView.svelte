<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db, type Routine } from '../lib/db'
  import { exerciseLabel } from '../lib/exercises'
  import { exerciseHistory, type ExerciseSession } from '../lib/history'
  import { onDestroy, onMount } from 'svelte'
  import { holdWakeLock } from '../lib/feedback'
  import { clearRest } from '../lib/rest.svelte'
  import { diffIsEmpty, getRoutine, routineDiff, type RoutineDiff } from '../lib/routines'
  import { addExerciseToSession, closeSession, setsFor, workingSets } from '../lib/sessions'
  import ExercisePicker from '../components/ExercisePicker.svelte'
  import RestTimer from '../components/RestTimer.svelte'
  import RoutinePrompt from '../components/RoutinePrompt.svelte'
  import SetLogger from '../components/SetLogger.svelte'

  let { sessionId, onclosed }: { sessionId: number; onclosed: () => void } = $props()

  let releaseWakeLock = () => {}
  onMount(() => (releaseWakeLock = holdWakeLock()))
  onDestroy(() => releaseWakeLock())

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

  let routine = $state<Routine | undefined>()
  let prompt = $state<{ routine: Routine; diff: RoutineDiff } | null>(null)

  $effect(() => {
    const type = $session?.type
    if (type) getRoutine(type).then((r) => (routine = r))
  })

  // The Routine's target sets, rep range and rest apply to Exercises it lists.
  const current = $derived.by(() => {
    const ex = $exercises?.find((e) => e.id === currentId)
    const entry = routine?.entries.find((e) => e.exerciseId === currentId)
    return ex && entry ? { ...ex, repMin: entry.repMin, repMax: entry.repMax, restCategory: entry.restCategory } : ex
  })
  const targetSets = $derived(routine?.entries.find((e) => e.exerciseId === currentId)?.targetSets)

  const remaining = $derived(($session?.exerciseIds ?? []).filter((id) => setsFor($session!, id).length === 0))
  const finished = $derived(($session?.exerciseIds ?? []).filter((id) => setsFor($session!, id).length > 0))

  async function addExercise(id: number) {
    await addExerciseToSession(sessionId, id)
    currentId = id
    adding = false
  }

  async function close() {
    const closed = await closeSession(sessionId)
    clearRest()
    const r = await getRoutine(closed.type)
    const diff = r ? routineDiff(r, closed) : undefined
    if (r && diff && !diffIsEmpty(diff)) prompt = { routine: r, diff }
    else onclosed()
  }
</script>

{#if prompt}
  <RoutinePrompt routine={prompt.routine} diff={prompt.diff} exercises={$exercises ?? []} ondone={onclosed} />
{:else if $session}
  <div class="row">
    <div class="grow muted">{$session.type} · {$session.location}{$session.trainer ? ' · trainer' : ''}</div>
    <button class="btn" onclick={close}>Done for today</button>
  </div>

  <RestTimer />

  {#if adding}
    <h2>Add Exercise</h2>
    <ExercisePicker exclude={$session.exerciseIds} onpick={addExercise} oncancel={() => (adding = false)} />
  {:else if current}
    <div class="row" style="margin-top:0.75rem">
      <h1 class="grow" style="margin:0">{exerciseLabel(current)}</h1>
    </div>
    {#if targetSets}
      <p class="muted">
        Target {targetSets} × {current.repMin}-{current.repMax} ·
        {workingSets(setsFor($session, current.id!)).length} done
      </p>
    {/if}
    {#key current.id}
      <SetLogger exercise={current} session={$session} {history} {routine} />
    {/key}
    <button class="btn block" style="margin-top:1rem" onclick={() => (currentId = null)}>Next Exercise ›</button>
  {:else}
    <h2>What's next?</h2>
    <div class="stack">
      {#each remaining as id (id)}
        {@const ex = $exercises?.find((e) => e.id === id)}
        {#if ex}
          <button class="btn primary" style="text-align:left" onclick={() => (currentId = id)}>{exerciseLabel(ex)}</button>
        {/if}
      {/each}
      <button class="btn" onclick={() => (adding = true)}>+ Add Exercise</button>
      <button class="btn" class:primary={remaining.length === 0} onclick={close}>Done for today</button>
      {#if finished.length}
        <div class="label">Done</div>
        {#each finished as id (id)}
          {@const ex = $exercises?.find((e) => e.id === id)}
          {#if ex}
            <button class="btn" style="text-align:left" onclick={() => (currentId = id)}>
              ✓ {exerciseLabel(ex)}
              <span class="muted"> · {workingSets(setsFor($session, id)).length} sets</span>
            </button>
          {/if}
        {/each}
      {/if}
    </div>
  {/if}
{/if}
