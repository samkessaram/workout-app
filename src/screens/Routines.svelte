<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db, type Routine, type RoutineEntry, type SessionType } from '../lib/db'
  import { exerciseLabel, REST_CATEGORIES, REST_SECONDS } from '../lib/exercises'
  import { entryFor, getRoutine, moveEntry, saveRoutine } from '../lib/routines'
  import { SESSION_TYPES } from '../lib/sessions'
  import Chips from '../components/Chips.svelte'
  import ExercisePicker from '../components/ExercisePicker.svelte'
  import Strip from '../components/Strip.svelte'

  let type = $state<SessionType>('lower')
  let routine = $state<Routine>({ sessionType: 'lower', entries: [] })
  let editing = $state<number | null>(null)
  let adding = $state(false)

  const exercises = liveQuery(() => db.exercises.toArray())

  $effect(() => {
    const t = type
    editing = null
    getRoutine(t).then((r) => (routine = r ?? { sessionType: t, entries: [] }))
  })

  async function persist(entries: RoutineEntry[]) {
    routine = { ...routine, entries }
    const id = await saveRoutine($state.snapshot(routine))
    routine.id = id
  }

  const label = (id: number) => {
    const e = $exercises?.find((x) => x.id === id)
    return e ? exerciseLabel(e) : 'Removed Exercise'
  }

  function patch(i: number, change: Partial<RoutineEntry>) {
    persist(routine.entries.map((e, j) => (j === i ? { ...e, ...change } : e)))
  }

  async function add(id: number) {
    const ex = $exercises?.find((x) => x.id === id)
    if (ex) await persist([...routine.entries, entryFor(ex)])
    adding = false
  }
</script>

<h1>Routines</h1>
<Chips options={SESSION_TYPES} selected={type} onpick={(t) => (type = t)} />

{#if adding}
  <h2>Add to {type} Routine</h2>
  <ExercisePicker exclude={routine.entries.map((e) => e.exerciseId)} onpick={add} oncancel={() => (adding = false)} />
{:else}
  <div class="stack" style="margin-top:1rem">
    {#each routine.entries as e, i (e.exerciseId)}
      <div class="card stack">
        <div class="row">
          <div class="grow">
            <div>{label(e.exerciseId)}</div>
            <div class="muted">{e.targetSets} × {e.repMin}-{e.repMax} · {e.restCategory} rest</div>
          </div>
          <button class="btn" aria-label="Move up" disabled={i === 0} onclick={() => persist(moveEntry(routine.entries, i, -1))}>↑</button>
          <button class="btn" aria-label="Move down" disabled={i === routine.entries.length - 1} onclick={() => persist(moveEntry(routine.entries, i, 1))}>↓</button>
        </div>
        {#if editing === i}
          <div>
            <div class="label">Target sets</div>
            <Strip value={e.targetSets} step={1} min={1} max={10} onchange={(n) => patch(i, { targetSets: n })} />
          </div>
          <div>
            <div class="label">Rep range: low</div>
            <Strip value={e.repMin} step={1} min={1} max={e.repMax} onchange={(n) => patch(i, { repMin: n })} />
          </div>
          <div>
            <div class="label">Rep range: high</div>
            <Strip value={e.repMax} step={1} min={e.repMin} max={50} onchange={(n) => patch(i, { repMax: n })} />
          </div>
          <div>
            <div class="label">Rest</div>
            <Chips
              options={REST_CATEGORIES}
              selected={e.restCategory}
              onpick={(c) => patch(i, { restCategory: c })}
              fmt={(c) => `${c} · ${REST_SECONDS[c]}s`}
            />
          </div>
          <div class="row">
            <button class="btn danger grow" onclick={() => persist(routine.entries.filter((_, j) => j !== i))}>Remove</button>
            <button class="btn grow" onclick={() => (editing = null)}>Close</button>
          </div>
        {:else}
          <button class="btn" onclick={() => (editing = i)}>Edit</button>
        {/if}
      </div>
    {:else}
      <p class="muted">No Exercises in the {type} Routine yet.</p>
    {/each}
    <button class="btn primary block" onclick={() => (adding = true)}>+ Add Exercise</button>
  </div>
{/if}
