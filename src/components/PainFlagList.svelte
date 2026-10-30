<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db, type PainFlag } from '../lib/db'
  import { exerciseLabel } from '../lib/exercises'
  import { resolveFlag } from '../lib/pain'

  let { flags: only, title = 'Open Pain flags' }: { flags?: PainFlag[]; title?: string } = $props()

  const data = liveQuery(async () => ({
    flags: (await db.painFlags.toArray()).filter((f) => f.resolvedAt === undefined),
    exercises: await db.exercises.toArray(),
  }))

  const flags = $derived(only ?? $data?.flags ?? [])
  const name = (id: number) => {
    const e = $data?.exercises.find((x) => x.id === id)
    return e ? exerciseLabel(e) : 'Exercise'
  }
</script>

{#if flags.length}
  <h2>{title}</h2>
  <div class="vstack">
    {#each flags as f (f.id)}
      <div class="card row">
        <div class="grow">
          <strong>{f.severity}</strong> · {f.action}{f.bodyArea ? ` · ${f.bodyArea}` : ''}
          <div class="muted">{name(f.exerciseId)} · {new Date(f.createdAt).toLocaleDateString('en-CA')}</div>
        </div>
        <button class="btn" onclick={() => resolveFlag(f.id!)}>Resolve</button>
      </div>
    {/each}
  </div>
{/if}
