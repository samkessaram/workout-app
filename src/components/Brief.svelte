<script lang="ts">
  import { acceptDeload, dismissDeload, type Brief } from '../lib/coach'
  import type { Exercise } from '../lib/db'
  import { exerciseLabel } from '../lib/exercises'
  import { setsFor, workingSets } from '../lib/sessions'
  import { fmtWeight } from '../lib/units'

  let { brief, exercises }: { brief: Brief; exercises: Exercise[] } = $props()

  const label = (id: number) => {
    const e = exercises.find((x) => x.id === id)
    return e ? exerciseLabel(e) : 'Exercise'
  }
</script>

<div class="card stack">
  <strong>Brief</strong>

  {#if brief.deload?.active}
    <div class="card">
      <strong>Deload week</strong> until {new Date(brief.deload.active.until).toLocaleDateString('en-CA')}:
      about 90% of your usual loads and half the sets.
    </div>
  {:else if brief.deload?.advice}
    <div class="card stack" role="alert">
      <div><strong>Consider a deload week.</strong> {brief.deload.advice.reason}</div>
      <div class="muted">One week, half the sets, about 90% load. Your call.</div>
      <div class="row">
        <button class="btn grow" onclick={async () => { await dismissDeload(); brief.deload = undefined }}>Not now</button>
        <button class="btn primary grow" onclick={async () => { await acceptDeload(); location.reload() }}>Start deload</button>
      </div>
    </div>
  {/if}

  {#if brief.flags.length}
    <div>
      <div class="label">Open Pain flags</div>
      {#each brief.flags as f (f.id)}
        <div class="error">⚠ {f.severity} · {f.action}{f.bodyArea ? ` · ${f.bodyArea}` : ''} ({label(f.exerciseId)})</div>
      {/each}
    </div>
  {/if}

  {#if brief.items.length}
    <div>
      <div class="label">Today's Suggestions</div>
      {#each brief.items as { exerciseId, suggestion: s } (exerciseId)}
        <div style="margin-bottom:0.4rem">
          {label(exerciseId)}:
          <strong>{s.weight === null ? 'pick a weight' : fmtWeight(s.weight, s.unit)} × {s.reps}</strong>
          <div class="muted">{s.stage} · {s.reason}</div>
        </div>
      {/each}
    </div>
  {/if}

  {#each brief.lastSessions as past (past.id)}
    <div>
      <div class="label">{past.date} · {past.location}</div>
      {#each past.exerciseIds as id (id)}
        {@const sets = workingSets(setsFor(past, id))}
        {#if sets.length}
          <div class="muted">{label(id)}: {sets.map((x) => `${fmtWeight(x.weight, x.unit)} × ${x.reps}`).join(', ')}</div>
        {/if}
      {/each}
    </div>
  {:else}
    <div class="muted">No earlier {''}Sessions of this type yet.</div>
  {/each}
</div>
