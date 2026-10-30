<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db, type Routine } from '../lib/db'
  import { exerciseLabel } from '../lib/exercises'
  import { applyBaseline, exerciseHistory, type ExerciseSession } from '../lib/history'
  import { onDestroy, onMount, untrack } from 'svelte'
  import { activeDeload, buildBrief, getDeloads, logSuggestion, suggestionFor, type Brief as BriefData } from '../lib/coach'
  import type { Suggestion } from '../lib/engine/types'
  import { CFG } from '../lib/engine/config'
  import { prefs } from '../lib/settings.svelte'
  import { flagsRelevantTo, openFlags, stoppedInSession } from '../lib/pain'
  import { setExerciseNote, toggleExerciseChip } from '../lib/chips'
  import { holdWakeLock } from '../lib/feedback'
  import { clearRest } from '../lib/rest.svelte'
  import { diffIsEmpty, getRoutine, routineDiff, type RoutineDiff } from '../lib/routines'
  import { addExerciseToSession, closeSession, setsFor, workingSets } from '../lib/sessions'
  import ExercisePicker from '../components/ExercisePicker.svelte'
  import PainFlagList from '../components/PainFlagList.svelte'
  import PainFlagPanel from '../components/PainFlagPanel.svelte'
  import Brief from '../components/Brief.svelte'
  import NoteChips from '../components/NoteChips.svelte'
  import RestTimer from '../components/RestTimer.svelte'
  import RoutinePrompt from '../components/RoutinePrompt.svelte'
  import SetLogger from '../components/SetLogger.svelte'

  let { sessionId, onclosed }: { sessionId: number; onclosed: () => void } = $props()

  let releaseWakeLock = () => {}
  onMount(() => (releaseWakeLock = holdWakeLock()))
  onDestroy(() => releaseWakeLock())

  const session = liveQuery(() => db.sessions.get(sessionId))
  const exercises = liveQuery(() => db.exercises.toArray())
  const flags = liveQuery(() => openFlags(db))

  let currentId = $state<number | null>(null)
  let adding = $state(false)
  let history = $state<ExerciseSession[]>([])
  let suggestion = $state<Suggestion | undefined>()
  let brief = $state<BriefData | undefined>()

  // Trainer mode is pure logging: no Brief, no Suggestions, nothing written to suggestionLog.
  const coaching = $derived($session ? !$session.trainer : false)

  $effect(() => {
    const id = currentId
    const on = coaching
    const answer = id === null ? undefined : $session?.baselineAnswers?.[id]
    void answer // a baseline answer changes which history applies, so re-ask the engine
    suggestion = undefined
    if (id === null || !on) return
    const s = untrack(() => $session)
    if (!s) return
    suggestionFor(id, s, untrack(() => prefs.unit)).then(async (sug) => {
      if (!sug || currentId !== id) return
      suggestion = sug
      await logSuggestion(sessionId, id, sug)
    })
  })

  // The Brief is built once, from the planned Exercises, before the first Set.
  let briefBuilt = false
  $effect(() => {
    const s = $session
    if (!s || !coaching || briefBuilt || s.exerciseIds.length === 0 && s.sets.length > 0) return
    briefBuilt = true
    buildBrief(s, untrack(() => prefs.unit)).then((b) => (brief = b))
  })

  // Unfiltered history feeds the baseline question; the Baseline split decides what chips and Suggestions use.
  let allHistory = $state<ExerciseSession[]>([])
  $effect(() => {
    const id = currentId
    allHistory = []
    if (id !== null) exerciseHistory(id, db, { excludeSessionId: sessionId }).then((h) => (allHistory = h))
  })
  $effect(() => {
    const s = $session
    const id = currentId
    history = s && id !== null ? applyBaseline(allHistory, s.location, s.baselineAnswers?.[id] === 'new') : []
  })

  let deloadActive = $state(false)
  onMount(async () => (deloadActive = !!activeDeload(await getDeloads(), $session?.startedAt ?? Date.now())))

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
  const plannedSets = $derived(routine?.entries.find((e) => e.exerciseId === currentId)?.targetSets)
  const targetSets = $derived(plannedSets && deloadActive ? Math.max(1, Math.ceil(plannedSets * CFG.deload.setFactor)) : plannedSets)

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
        {deloadActive ? 'Deload: ' : ''}Target {targetSets} × {current.repMin}-{current.repMax} ·
        {workingSets(setsFor($session, current.id!)).length} done
      </p>
    {/if}
    {#if stoppedInSession(current.id!, $session, $flags ?? [])}
      <p class="card error" role="alert">Sharp pain flagged — you marked this movement to stop today.</p>
    {/if}
    <PainFlagList flags={flagsRelevantTo(current, $flags ?? [])} title="Open Pain flags here" />
    <div class="row" style="margin:0.5rem 0">
      <PainFlagPanel exercise={current} />
    </div>
    <NoteChips
      summary="Exercise notes"
      chips={$session.exerciseChips?.[current.id!] ?? []}
      note={$session.exerciseNotes?.[current.id!] ?? ''}
      ontoggle={(c) => toggleExerciseChip(sessionId, current.id!, c)}
      onnote={(t) => setExerciseNote(sessionId, current.id!, t)}
    />
    {#key current.id}
      <SetLogger exercise={current} session={$session} {history} {allHistory} {routine} {suggestion} />
    {/key}
    <button class="btn btn-block" style="margin-top:1rem" onclick={() => (currentId = null)}>Next Exercise ›</button>
  {:else}
    {#if brief && finished.length === 0}
      <Brief {brief} exercises={$exercises ?? []} />
    {/if}
    <h2>What's next?</h2>
    <div class="vstack">
      {#each remaining as id (id)}
        {@const ex = $exercises?.find((e) => e.id === id)}
        {#if ex}
          <button class="btn btn-primary" style="text-align:left" onclick={() => (currentId = id)}>{exerciseLabel(ex)}</button>
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
