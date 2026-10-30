<script lang="ts">
  import type { Exercise, SessionSet } from '../lib/db'
    import { setSetNote, toggleSetChip } from '../lib/chips'
  import { correctSet } from '../lib/sessions'
  import { prefs } from '../lib/settings.svelte'
  import { convert, fmtWeight, roundTo, stepIn } from '../lib/units'
  import NoteChips from './NoteChips.svelte'
  import Strip from './Strip.svelte'

  let {
    set,
    label,
    sessionId,
    exercise,
    editable = true,
  }: { set: SessionSet; label: string; sessionId: number; exercise: Exercise; editable?: boolean } = $props()

  let open = $state(false)
  let weight = $state(0)
  let reps = $state(0)
  let error = $state('')

  const unit = $derived(prefs.unit)
  const step = $derived(stepIn(exercise, unit))

  function begin() {
    weight = roundTo(convert(set.weight, set.unit, unit), step)
    // Keep the entered value exactly when the unit is unchanged.
    if (set.unit === unit) weight = set.weight
    reps = set.reps
    open = true
  }

  async function save() {
    try {
      await correctSet(sessionId, set.id, { weight, unit, reps })
      open = false
      error = ''
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  <div class="grow">
    {label}: {fmtWeight(set.weight, set.unit)} × {set.reps}
    {#if set.prev?.length}
      <span class="text-base-content/60 text-sm">
        (corrected from {set.prev.map((p) => `${fmtWeight(p.weight, p.unit)} × ${p.reps}`).join(' → ')})
      </span>
    {/if}
  </div>
  {#if editable && !open}
    <button class="btn" onclick={begin}>Correct</button>
  {/if}
</div>

{#if open}
  <div class="grid grid-cols-1 gap-3" style="margin:0.5rem 0">
    <div class="label whitespace-normal mb-1">Correct weight ({unit})</div>
    <Strip value={weight} {step} onchange={(w) => (weight = w)} />
    <div class="label whitespace-normal mb-1">Correct reps</div>
    <Strip value={reps} step={1} min={1} onchange={(r) => (reps = r)} />
    {#if error}<p class="text-error" role="alert">{error}</p>{/if}
    <div class="flex flex-wrap items-center gap-2">
      <button class="btn grow" onclick={() => (open = false)}>Cancel</button>
      <button class="btn btn-primary grow" onclick={save}>Save correction</button>
    </div>
  </div>
{/if}

<div style="margin:0.25rem 0 0.75rem">
  <NoteChips
    chips={set.chips ?? []}
    note={set.note ?? ''}
    ontoggle={(c) => toggleSetChip(sessionId, set.id, c)}
    onnote={(t) => setSetNote(sessionId, set.id, t)}
  />
</div>
