<script lang="ts">
  import type { Brief } from '../lib/coach'
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
