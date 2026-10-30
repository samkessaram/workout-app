<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { exerciseLabel } from '../lib/exercises'
  import { exerciseHistory, type ExerciseSession } from '../lib/history'
  import { summarizeSets } from '../lib/historyView'
  import { clearRest } from '../lib/rest.svelte'
  import { deleteSession, setsFor } from '../lib/sessions'
  import Chips from '../components/Chips.svelte'
  import SetRow from '../components/SetRow.svelte'

  const data = liveQuery(async () => ({
    sessions: (await db.sessions.toArray()).sort((a, b) => b.startedAt - a.startedAt),
    exercises: (await db.exercises.toArray()).sort((a, b) => exerciseLabel(a).localeCompare(exerciseLabel(b))),
  }))

  let tab = $state<'sessions' | 'exercises'>('sessions')
  let sessionId = $state<number | null>(null)
  let exerciseId = $state<number | null>(null)
  let past = $state<ExerciseSession[]>([])
  let confirmDelete = $state(false)

  // Re-read whenever the Session data changes, so Corrections show up straight away.
  $effect(() => {
    $data
    const id = exerciseId
    if (id === null) past = []
    else exerciseHistory(id, db).then((h) => (past = h.reverse()))
  })

  async function remove() {
    const id = sessionId
    if (id === null) return
    if (session?.closedAt === undefined) clearRest()
    await deleteSession(id, db)
    confirmDelete = false
    sessionId = null
  }

  const sessions = $derived($data?.sessions ?? [])
  const exercises = $derived($data?.exercises ?? [])
  const session = $derived(sessions.find((s) => s.id === sessionId))
  const exercise = $derived(exercises.find((e) => e.id === exerciseId))
  const nameOf = (id: number) => {
    const e = exercises.find((x) => x.id === id)
    return e ? exerciseLabel(e) : 'Exercise'
  }
</script>

{#if session}
  <div class="flex flex-wrap items-center gap-2">
    <button class="btn" onclick={() => (sessionId = null)}>‹ History</button>
    <h1 class="grow" style="margin:0">{session.date}</h1>
  </div>
  <p class="text-base-content/60 text-sm">{session.type} · {session.location}{session.trainer ? ' · trainer' : ''}{session.closedAt === undefined ? ' · in progress' : ''}</p>
  <div class="grid grid-cols-1 gap-3">
    {#each session.exerciseIds as id (id)}
      {@const ex = exercises.find((e) => e.id === id)}
      {@const sets = setsFor(session, id)}
      {#if ex && sets.length}
        <div class="card card-border bg-base-100 p-4 grid grid-cols-1 gap-3">
          <strong>{exerciseLabel(ex)}</strong>
          {#if session.exerciseChips?.[id]?.length || session.exerciseNotes?.[id]}
            <div class="text-base-content/60 text-sm">{[...(session.exerciseChips?.[id] ?? []), session.exerciseNotes?.[id]].filter(Boolean).join(', ')}</div>
          {/if}
          <div>
            {#each sets as s, i (s.id)}
              <div class:warmup={s.warmup}>
                <SetRow set={s} sessionId={session.id!} exercise={ex} label={s.warmup ? 'Warmup' : `Set ${sets.slice(0, i + 1).filter((x) => !x.warmup).length}`} />
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {:else}
      <p class="text-base-content/60 text-sm">No sets were logged.</p>
    {/each}
    {#if confirmDelete}
      <div class="card card-border bg-base-100 p-4 grid grid-cols-1 gap-3" role="alertdialog">
        <div>Delete this Session and all its Sets? This can't be undone, and progression forgets it.</div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn grow" onclick={() => (confirmDelete = false)}>Cancel</button>
          <button class="btn btn-error grow" onclick={remove}>Yes, delete</button>
        </div>
      </div>
    {:else}
      <button class="btn btn-error btn-outline" onclick={() => (confirmDelete = true)}>Delete Session</button>
    {/if}
  </div>
{:else if exercise}
  <div class="flex flex-wrap items-center gap-2">
    <button class="btn" onclick={() => (exerciseId = null)}>‹ History</button>
    <h1 class="grow" style="margin:0;font-size:1.2rem">{exerciseLabel(exercise)}</h1>
  </div>
  {#if past.length}
    <p class="card card-border bg-base-100 p-4">
      <strong>Last time ({past[0].date}, {past[0].location}):</strong>
      {summarizeSets(past[0].sets)}
    </p>
    <h2>Progress</h2>
    <div class="grid grid-cols-1 gap-3">
      {#each past as h (h.sessionId)}
        <button class="card card-border bg-base-100 p-4" style="text-align:left" onclick={() => (sessionId = h.sessionId)}>
          <div>{h.date} <span class="text-base-content/60 text-sm">· {h.location}{h.trainer ? ' · trainer' : ''}</span></div>
          <div>{summarizeSets(h.sets)}</div>
          {#if h.chips.length}<div class="text-base-content/60 text-sm">{h.chips.join(', ')}</div>{/if}
        </button>
      {/each}
    </div>
  {:else}
    <p class="text-base-content/60 text-sm">Nothing logged for this Exercise yet.</p>
  {/if}
{:else}
  <h1>History</h1>
  <Chips options={['sessions', 'exercises'] as const} selected={tab} onpick={(t) => (tab = t)} fmt={(t) => (t === 'sessions' ? 'Sessions' : 'Exercises')} />
  <div class="grid grid-cols-1 gap-3" style="margin-top:1rem">
    {#if tab === 'sessions'}
      {#each sessions as s (s.id)}
        <button class="card card-border bg-base-100 p-4" style="text-align:left" onclick={() => (sessionId = s.id!)}>
          <div>{s.date} · {s.type} <span class="text-base-content/60 text-sm">· {s.location}{s.trainer ? ' · trainer' : ''}</span></div>
          <div class="text-base-content/60 text-sm">
            {s.exerciseIds.filter((id) => setsFor(s, id).length).map(nameOf).join(', ') || 'No sets logged'}
          </div>
        </button>
      {:else}
        <p class="text-base-content/60 text-sm">No Sessions yet.</p>
      {/each}
    {:else}
      {#each exercises as e (e.id)}
        <button class="btn" style="text-align:left" onclick={() => (exerciseId = e.id!)}>{exerciseLabel(e)}</button>
      {:else}
        <p class="text-base-content/60 text-sm">No Exercises yet.</p>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .warmup { opacity: 0.7; font-style: italic; }
</style>
