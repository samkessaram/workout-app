<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db, type RoutineEntry, type SessionType } from '../lib/db'
  import { exerciseLabel, REST_CATEGORIES, REST_SECONDS } from '../lib/exercises'
  import { deleteRoutine, entryFor, listRoutines, moveEntry, routineLabel, saveRoutine } from '../lib/routines'
  import { SESSION_TYPES } from '../lib/sessions'
  import Chips from '../components/Chips.svelte'
  import ExercisePicker from '../components/ExercisePicker.svelte'
  import Strip from '../components/Strip.svelte'

  let openId = $state<number | null>(null)
  let editing = $state<number | null>(null)
  let adding = $state(false)
  let creating = $state(false)
  let newName = $state('')
  let newType = $state<SessionType | undefined>()
  let confirmDelete = $state(false)

  const exercises = liveQuery(() => db.exercises.toArray())
  const all = liveQuery(() => listRoutines())

  const routines = $derived(
    [...($all ?? [])].sort((a, b) => SESSION_TYPES.indexOf(a.sessionType) - SESSION_TYPES.indexOf(b.sessionType) || a.id! - b.id!),
  )
  const routine = $derived(routines.find((r) => r.id === openId))

  function open(id: number | null) {
    openId = id
    editing = null
    adding = false
    confirmDelete = false
  }

  async function persist(entries: RoutineEntry[]) {
    if (routine) await saveRoutine({ ...$state.snapshot(routine), entries })
  }

  async function rename(name: string) {
    if (routine && name.trim() && name.trim() !== routine.name) await saveRoutine({ ...$state.snapshot(routine), name: name.trim() })
  }

  async function create() {
    if (!newType || !newName.trim()) return
    const id = await saveRoutine({ sessionType: newType, name: newName.trim(), entries: [] })
    creating = false
    newName = ''
    newType = undefined
    open(id)
  }

  async function remove() {
    if (routine) await deleteRoutine(routine.id!)
    open(null)
  }

  const label = (id: number) => {
    const e = $exercises?.find((x) => x.id === id)
    return e ? exerciseLabel(e) : 'Removed Exercise'
  }

  function patch(i: number, change: Partial<RoutineEntry>) {
    if (routine) persist(routine.entries.map((e, j) => (j === i ? { ...e, ...change } : e)))
  }

  async function add(id: number) {
    const ex = $exercises?.find((x) => x.id === id)
    if (ex && routine) await persist([...routine.entries, entryFor(ex)])
    adding = false
  }
</script>

{#if routine && adding}
  <h2>Add to {routineLabel(routine)}</h2>
  <ExercisePicker exclude={routine.entries.map((e) => e.exerciseId)} onpick={add} oncancel={() => (adding = false)} />
{:else if routine}
  <div class="flex flex-wrap items-center gap-2">
    <button class="btn" onclick={() => open(null)}>‹ Routines</button>
    <h1 class="grow" style="margin:0">{routineLabel(routine)}</h1>
  </div>
  <p class="text-base-content/60 text-sm">{routine.sessionType}</p>
  <div class="grid grid-cols-1 gap-3" style="margin-top:1rem">
    <label class="grid gap-1">
      <span class="label">Name</span>
      <input class="input w-full" type="text" value={routineLabel(routine)} onchange={(e) => rename(e.currentTarget.value)} />
    </label>
    {#each routine.entries as e, i (e.exerciseId)}
      <div class="card card-border bg-base-100 p-4 grid grid-cols-1 gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="grow">
            <div>{label(e.exerciseId)}</div>
            <div class="text-base-content/60 text-sm">{e.targetSets} × {e.repMin}-{e.repMax} · {e.restCategory} rest</div>
          </div>
          <button class="btn" aria-label="Move up" disabled={i === 0} onclick={() => persist(moveEntry(routine.entries, i, -1))}>↑</button>
          <button class="btn" aria-label="Move down" disabled={i === routine.entries.length - 1} onclick={() => persist(moveEntry(routine.entries, i, 1))}>↓</button>
          <button class="btn btn-error btn-outline" aria-label={`Remove ${label(e.exerciseId)}`} onclick={() => persist(routine.entries.filter((_, j) => j !== i))}>✕</button>
        </div>
        {#if editing === i}
          <div>
            <div class="label whitespace-normal mb-1">Target sets</div>
            <Strip value={e.targetSets} step={1} min={1} max={10} onchange={(n) => patch(i, { targetSets: n })} />
          </div>
          <div>
            <div class="label whitespace-normal mb-1">Rep range: low</div>
            <Strip value={e.repMin} step={1} min={1} max={e.repMax} onchange={(n) => patch(i, { repMin: n })} />
          </div>
          <div>
            <div class="label whitespace-normal mb-1">Rep range: high</div>
            <Strip value={e.repMax} step={1} min={e.repMin} max={50} onchange={(n) => patch(i, { repMax: n })} />
          </div>
          <div>
            <div class="label whitespace-normal mb-1">Rest</div>
            <Chips
              options={REST_CATEGORIES}
              selected={e.restCategory}
              onpick={(c) => patch(i, { restCategory: c })}
              fmt={(c) => `${c} · ${REST_SECONDS[c]}s`}
            />
          </div>
          <button class="btn" onclick={() => (editing = null)}>Close</button>
        {:else}
          <button class="btn" onclick={() => (editing = i)}>Edit</button>
        {/if}
      </div>
    {:else}
      <p class="text-base-content/60 text-sm">No Exercises in {routineLabel(routine)} yet.</p>
    {/each}
    <button class="btn btn-primary btn-block" onclick={() => (adding = true)}>+ Add Exercise</button>
    {#if confirmDelete}
      <div class="card card-border bg-base-100 p-4 grid grid-cols-1 gap-3" role="alertdialog">
        <div>Delete {routineLabel(routine)}? Past Sessions keep their Sets.</div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn grow" onclick={() => (confirmDelete = false)}>Cancel</button>
          <button class="btn btn-error grow" onclick={remove}>Yes, delete</button>
        </div>
      </div>
    {:else}
      <button class="btn btn-error btn-outline" onclick={() => (confirmDelete = true)}>Delete Routine</button>
    {/if}
  </div>
{:else}
  <h1>Routines</h1>
  <div class="grid grid-cols-1 gap-3">
    {#each routines as r (r.id)}
      <button class="card card-border bg-base-100 p-4" style="text-align:left" onclick={() => open(r.id!)}>
        <div>{routineLabel(r)}</div>
        <div class="text-base-content/60 text-sm">{r.sessionType} · {r.entries.length} {r.entries.length === 1 ? 'Exercise' : 'Exercises'}</div>
      </button>
    {:else}
      <p class="text-base-content/60 text-sm">No Routines yet.</p>
    {/each}
    {#if creating}
      <div class="card card-border bg-base-100 p-4 grid grid-cols-1 gap-3">
        <input class="input w-full" type="text" placeholder="Name, e.g. Upper B" aria-label="Routine name" bind:value={newName} />
        <div>
          <div class="label whitespace-normal mb-1">Session type</div>
          <Chips options={SESSION_TYPES} selected={newType} onpick={(t) => (newType = t)} />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn grow" onclick={() => { creating = false; newName = ''; newType = undefined }}>Cancel</button>
          <button class="btn btn-primary grow" disabled={!newType || !newName.trim()} onclick={create}>Create</button>
        </div>
      </div>
    {:else}
      <button class="btn btn-primary btn-block" onclick={() => (creating = true)}>+ New Routine</button>
    {/if}
  </div>
{/if}
