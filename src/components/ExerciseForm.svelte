<script lang="ts">
  import type { Exercise, ExerciseKind, Unit } from '../lib/db'
  import {
    EQUIPMENT, JOINTS, KINDS, KIND_DEFAULTS, MUSCLES, REST_CATEGORIES, REST_SECONDS, saveExercise, stepOptions,
  } from '../lib/exercises'
  import { fmtWeight, roundTo } from '../lib/units'
  import Chips from './Chips.svelte'
  import Strip from './Strip.svelte'

  let { exercise, ondone }: { exercise: Exercise; ondone: () => void } = $props()

  // The form edits a copy; it deliberately captures the initial prop value.
  // svelte-ignore state_referenced_locally
  let form = $state<Exercise>({ ...exercise, bodyAreas: [...exercise.bodyAreas] })
  let error = $state('')
  let showKindHelp = $state(false)
  // svelte-ignore state_referenced_locally
  let startText = $state(exercise.startWeight === undefined ? '' : String(exercise.startWeight))
  // svelte-ignore state_referenced_locally
  const isNew = exercise.id === undefined

  function pickKind(k: ExerciseKind) {
    form.kind = k
    if (isNew) {
      const d = KIND_DEFAULTS[k]
      form.repMin = d.repMin
      form.repMax = d.repMax
      form.restCategory = d.rest
    }
  }

  function toggleArea(a: string) {
    form.bodyAreas = form.bodyAreas.includes(a) ? form.bodyAreas.filter((x) => x !== a) : [...form.bodyAreas, a]
  }

  async function save() {
    try {
      const start = startText.trim() === '' ? undefined : Number(startText)
      if (form.equipment !== 'bodyweight' && (start === undefined || !(start > 0))) {
        throw new Error('Enter a starting weight')
      }
      form.startWeight = start === undefined || Number.isNaN(start) ? undefined : roundTo(start, form.step)
      await saveExercise($state.snapshot(form))
      ondone()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }
</script>

<div class="grid grid-cols-1 gap-3">
  <label class="grid gap-1">
    <span class="label">Name</span>
    <input class="input w-full" type="text" bind:value={form.name} placeholder="e.g. Leg Press" />
  </label>

  <div>
    <div class="label whitespace-normal mb-1">Equipment</div>
    <Chips options={EQUIPMENT} selected={form.equipment} onpick={(o) => (form.equipment = o)} />
  </div>

  <div>
    <div class="label mb-1 gap-1">
      Kind
      <button
        type="button"
        class="btn btn-circle btn-ghost btn-sm"
        aria-label="What do these mean?"
        aria-expanded={showKindHelp}
        onclick={() => (showKindHelp = !showKindHelp)}>ⓘ</button>
    </div>
    {#if showKindHelp}
      <div class="card card-border bg-base-100 p-4 grid grid-cols-1 gap-3 mb-2 text-sm" role="note">
        {#each KINDS as k (k.id)}
          <div><strong>{k.label}.</strong> {k.help}</div>
        {/each}
      </div>
    {/if}
    <Chips
      options={KINDS.map((k) => k.id)}
      selected={form.kind}
      onpick={pickKind}
      fmt={(id) => KINDS.find((k) => k.id === id)!.label}
    />
  </div>

  <div>
    <div class="label whitespace-normal mb-1">Smallest weight jump ({form.stepUnit})</div>
    <Chips
      options={stepOptions(form.stepUnit as Unit)}
      selected={form.step}
      onpick={(o) => (form.step = o)}
      fmt={(n) => fmtWeight(n, form.stepUnit)}
    />
  </div>

  {#if form.equipment !== 'bodyweight'}
    <label class="grid gap-1">
      <span class="label">Starting weight ({form.stepUnit})</span>
      <input class="input w-full" type="text" inputmode="decimal" bind:value={startText} placeholder="e.g. 45" />
      <span class="text-base-content/60 text-sm">Your first Session starts here. After that the app suggests from your history.</span>
    </label>
  {/if}

  <div>
    <div class="label whitespace-normal mb-1">Rep range: low</div>
    <Strip value={form.repMin} step={1} min={1} max={form.repMax} onchange={(n) => (form.repMin = n)} />
  </div>
  <div>
    <div class="label whitespace-normal mb-1">Rep range: high</div>
    <Strip value={form.repMax} step={1} min={form.repMin} max={50} onchange={(n) => (form.repMax = n)} />
  </div>

  <div>
    <div class="label whitespace-normal mb-1">Rest</div>
    <Chips
      options={REST_CATEGORIES}
      selected={form.restCategory}
      onpick={(o) => (form.restCategory = o)}
      fmt={(c) => `${c} · ${REST_SECONDS[c]}s`}
    />
  </div>

  <div>
    <div class="label whitespace-normal mb-1">Main muscle</div>
    <Chips options={MUSCLES} selected={form.muscle} onpick={(m) => (form.muscle = form.muscle === m ? undefined : m)} />
  </div>

  <div>
    <div class="label whitespace-normal mb-1">Joints it loads (for Pain flags)</div>
    <Chips options={JOINTS} selected={form.bodyAreas} onpick={toggleArea} />
  </div>

  {#if error}<p class="text-error" role="alert">{error}</p>{/if}

  <div class="flex flex-wrap items-center gap-2">
    <button class="btn grow" onclick={ondone}>Cancel</button>
    <button class="btn btn-primary grow" onclick={save}>Save</button>
  </div>
</div>
