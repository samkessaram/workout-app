<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import { exerciseLabel } from '../lib/exercises'
  import { exerciseHistory, type ExerciseSession } from '../lib/history'
  import { summarizeSets } from '../lib/historyView'
  import { setsFor } from '../lib/sessions'
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

  // Re-read whenever the Session data changes, so Corrections show up straight away.
  $effect(() => {
    $data
    const id = exerciseId
    if (id === null) past = []
    else exerciseHistory(id, db).then((h) => (past = h.reverse()))
  })

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
  <div class="row">
    <button class="btn" onclick={() => (sessionId = null)}>‹ History</button>
    <h1 class="grow" style="margin:0">{session.date}</h1>
  </div>
  <p class="muted">{session.type} · {session.location}{session.trainer ? ' · trainer' : ''}{session.closedAt === undefined ? ' · in progress' : ''}</p>
  <div class="vstack">
    {#each session.exerciseIds as id (id)}
      {@const ex = exercises.find((e) => e.id === id)}
      {@const sets = setsFor(session, id)}
      {#if ex && sets.length}
        <div class="card vstack">
          <strong>{exerciseLabel(ex)}</strong>
          {#if session.exerciseChips?.[id]?.length || session.exerciseNotes?.[id]}
            <div class="muted">{[...(session.exerciseChips?.[id] ?? []), session.exerciseNotes?.[id]].filter(Boolean).join(', ')}</div>
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
      <p class="muted">No sets were logged.</p>
    {/each}
  </div>
{:else if exercise}
  <div class="row">
    <button class="btn" onclick={() => (exerciseId = null)}>‹ History</button>
    <h1 class="grow" style="margin:0;font-size:1.2rem">{exerciseLabel(exercise)}</h1>
  </div>
  {#if past.length}
    <p class="card">
      <strong>Last time ({past[0].date}, {past[0].location}):</strong>
      {summarizeSets(past[0].sets)}
    </p>
    <h2>Progress</h2>
    <div class="vstack">
      {#each past as h (h.sessionId)}
        <button class="card" style="text-align:left" onclick={() => (sessionId = h.sessionId)}>
          <div>{h.date} <span class="muted">· {h.location}{h.trainer ? ' · trainer' : ''}</span></div>
          <div>{summarizeSets(h.sets)}</div>
          {#if h.chips.length}<div class="muted">{h.chips.join(', ')}</div>{/if}
        </button>
      {/each}
    </div>
  {:else}
    <p class="muted">Nothing logged for this Exercise yet.</p>
  {/if}
{:else}
  <h1>History</h1>
  <Chips options={['sessions', 'exercises'] as const} selected={tab} onpick={(t) => (tab = t)} fmt={(t) => (t === 'sessions' ? 'Sessions' : 'Exercises')} />
  <div class="vstack" style="margin-top:1rem">
    {#if tab === 'sessions'}
      {#each sessions as s (s.id)}
        <button class="card" style="text-align:left" onclick={() => (sessionId = s.id!)}>
          <div>{s.date} · {s.type} <span class="muted">· {s.location}{s.trainer ? ' · trainer' : ''}</span></div>
          <div class="muted">
            {s.exerciseIds.filter((id) => setsFor(s, id).length).map(nameOf).join(', ') || 'No sets logged'}
          </div>
        </button>
      {:else}
        <p class="muted">No Sessions yet.</p>
      {/each}
    {:else}
      {#each exercises as e (e.id)}
        <button class="btn" style="text-align:left" onclick={() => (exerciseId = e.id!)}>{exerciseLabel(e)}</button>
      {:else}
        <p class="muted">No Exercises yet.</p>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .warmup { opacity: 0.7; font-style: italic; }
</style>
