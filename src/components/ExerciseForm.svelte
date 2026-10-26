<script lang="ts">
  import type { Exercise, ExerciseKind, Unit } from '../lib/db'
  import {
    EQUIPMENT, JOINTS, KINDS, KIND_DEFAULTS, MUSCLES, REST_CATEGORIES, REST_SECONDS, saveExercise, stepOptions,
  } from '../lib/exercises'
  import { fmtWeight } from '../lib/units'
  import Chips from './Chips.svelte'
  import Strip from './Strip.svelte'

  let { exercise, ondone }: { exercise: Exercise; ondone: () => void } = $props()

  // The form edits a copy; it deliberately captures the initial prop value.
  // svelte-ignore state_referenced_locally
  let form = $state<Exercise>({ ...exercise, bodyAreas: [...exercise.bodyAreas] })
  let error = $state('')
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
      await saveExercise($state.snapshot(form))
      ondone()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }
</script>

<div class="stack">
  <label class="field">
    <span>Name</span>
    <input type="text" bind:value={form.name} placeholder="e.g. Leg Press" />
  </label>

  <div>
    <div class="label">Equipment</div>
    <Chips options={EQUIPMENT} selected={form.equipment} onpick={(o) => (form.equipment = o)} />
  </div>

  <div>
    <div class="label">Kind</div>
    <Chips
      options={KINDS.map((k) => k.id)}
      selected={form.kind}
      onpick={pickKind}
      fmt={(id) => KINDS.find((k) => k.id === id)!.label}
    />
  </div>

  <div>
    <div class="label">Smallest weight jump ({form.stepUnit})</div>
    <Chips
      options={stepOptions(form.stepUnit as Unit)}
      selected={form.step}
      onpick={(o) => (form.step = o)}
      fmt={(n) => fmtWeight(n, form.stepUnit)}
    />
  </div>

  <div>
    <div class="label">Rep range: low</div>
    <Strip value={form.repMin} step={1} min={1} max={form.repMax} onchange={(n) => (form.repMin = n)} />
  </div>
  <div>
    <div class="label">Rep range: high</div>
    <Strip value={form.repMax} step={1} min={form.repMin} max={50} onchange={(n) => (form.repMax = n)} />
  </div>

  <div>
    <div class="label">Rest</div>
    <Chips
      options={REST_CATEGORIES}
      selected={form.restCategory}
      onpick={(o) => (form.restCategory = o)}
      fmt={(c) => `${c} · ${REST_SECONDS[c]}s`}
    />
  </div>

  <div>
    <div class="label">Main muscle</div>
    <Chips options={MUSCLES} selected={form.muscle} onpick={(m) => (form.muscle = form.muscle === m ? undefined : m)} />
  </div>

  <div>
    <div class="label">Joints it loads (for Pain flags)</div>
    <Chips options={JOINTS} selected={form.bodyAreas} onpick={toggleArea} />
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="row">
    <button class="btn grow" onclick={ondone}>Cancel</button>
    <button class="btn primary grow" onclick={save}>Save</button>
  </div>
</div>
