<script lang="ts">
  import { db, type Exercise, type Routine, type Session } from '../lib/db'
  import { repChips, weightChips, type ExerciseSession } from '../lib/history'
  import { restFor } from '../lib/rest'
  import { startRest } from '../lib/rest.svelte'
  import type { Suggestion } from '../lib/engine/types'
  import { recordActual } from '../lib/coach'
  import { addSet, setsFor } from '../lib/sessions'
  import { prefs } from '../lib/settings.svelte'
  import { fmtWeight, stepIn } from '../lib/units'
  import Chips from './Chips.svelte'
  import SetRow from './SetRow.svelte'
  import Strip from './Strip.svelte'

  let {
    exercise,
    session,
    history,
    suggestion,
    routine,
  }: {
    exercise: Exercise
    session: Session
    history: ExerciseSession[]
    suggestion?: Suggestion
    routine?: Routine
  } = $props()

  const unit = $derived(prefs.unit)
  const step = $derived(stepIn(exercise, unit))
  const chips = $derived(weightChips(history, exercise, unit, suggestion?.weight ?? undefined))
  const recReps = $derived(suggestion?.reps ?? Math.round((exercise.repMin + exercise.repMax) / 2))
  const reps = $derived(
    [...new Set([...repChips(exercise.repMin, exercise.repMax), recReps])].sort((a, b) => a - b),
  )

  // Picked values override the recommendation until a Set is logged.
  let pickedWeight = $state<number | undefined>()
  let pickedReps = $state<number | undefined>()
  let warmup = $state(false)
  let error = $state('')

  const weight = $derived(pickedWeight ?? chips.recommended ?? 0)
  const repCount = $derived(pickedReps ?? recReps)
  const canLog = $derived(repCount >= 1 && (weight > 0 || exercise.equipment === 'bodyweight'))

  async function log() {
    try {
      const added = await addSet(session.id!, { exerciseId: exercise.id!, weight, unit, reps: repCount, warmup })
      const secs = restFor({ ...session, sets: [...session.sets, added] }, routine, added, exercise.restCategory)
      if (secs !== null) startRest(secs)
      pickedWeight = weight
      pickedReps = repCount
      warmup = false
      error = ''
      await recordActual(session.id!, exercise.id!, db)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  const logged = $derived(setsFor(session, exercise.id!))
</script>

<div class="stack">
  {#if suggestion}
    <p class="card">
      <strong>Suggestion</strong> <span class="muted">({suggestion.stage})</span>:
      {suggestion.weight === null ? 'pick a weight' : fmtWeight(suggestion.weight, suggestion.unit)} × {suggestion.reps}
      <span class="muted"> — {suggestion.reason}</span>
    </p>
  {/if}
  {#if chips.options.length === 0}
    <p class="muted">No history for this Exercise yet. Pick a conservative weight.</p>
  {:else}
    <div>
      <div class="label">Weight</div>
      <Chips
        options={chips.options}
        selected={weight}
        recommended={chips.recommended}
        onpick={(w) => (pickedWeight = w)}
        fmt={(w) => fmtWeight(w, unit)}
      />
    </div>
  {/if}

  <Strip value={weight} {step} onchange={(w) => (pickedWeight = w)} fmt={(w) => String(w)} />

  <div>
    <div class="label">Reps</div>
    <Chips options={reps} selected={repCount} recommended={recReps} onpick={(r) => (pickedReps = r)} />
  </div>
  <Strip value={repCount} step={1} min={1} onchange={(r) => (pickedReps = r)} />

  <div class="row">
    <button class="chip" class:on={warmup} aria-pressed={warmup} onclick={() => (warmup = !warmup)}>Warmup</button>
    <button class="btn primary grow" disabled={!canLog} onclick={log}>
      Log {warmup ? 'warmup' : 'set'} · {fmtWeight(weight, unit)} × {repCount}
    </button>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if logged.length}
    <div class="card">
      {#each logged as s, i (s.id)}
        <SetRow
          set={s}
          sessionId={session.id!}
          {exercise}
          label={s.warmup ? 'Warmup' : `Set ${logged.slice(0, i + 1).filter((x) => !x.warmup).length}`}
        />
      {/each}
    </div>
  {/if}
</div>
