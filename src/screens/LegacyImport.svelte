<script lang="ts">
  import { db } from '../lib/db'
  import { exerciseLabel } from '../lib/exercises'
  import { importLegacy, seedRoutines, type ImportResult, type Resolution } from '../lib/legacy/import'
  import { draftExercise, planImport, type PlanItem } from '../lib/legacy/map'
  import { parseLegacy, type ParseResult } from '../lib/legacy/parse'
  import { prefs } from '../lib/settings.svelte'
  import ExercisePicker from '../components/ExercisePicker.svelte'
  import type { Exercise } from '../lib/db'

  let { onback }: { onback: () => void } = $props()

  let parsed = $state<ParseResult | null>(null)
  let plan = $state<PlanItem[]>([])
  let library = $state<Exercise[]>([])
  let resolutions = $state<Record<string, Resolution>>({})
  let mapping = $state<string | null>(null)
  let result = $state<(ImportResult & { seeded: string[] }) | null>(null)
  let busy = $state(false)
  let error = $state('')

  async function pick(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement
    const files = [...(input.files ?? [])]
    input.value = ''
    if (!files.length) return
    error = ''
    result = null
    const inputs = await Promise.all(
      files.map(async (f) => ({ name: f.webkitRelativePath || f.name, text: await f.text() })),
    )
    parsed = parseLegacy(inputs)
    library = await db.exercises.toArray()
    plan = planImport(parsed.sessions, library)
    resolutions = Object.fromEntries(
      plan.map((p) => [
        p.id,
        p.matchedId !== undefined
          ? ({ kind: 'map', exerciseId: p.matchedId } as Resolution)
          : ({ kind: 'create', exercise: draftExercise(p.name, p.equipment, prefs.unit) } as Resolution),
      ]),
    )
  }

  const label = (id: number) => {
    const e = library.find((x) => x.id === id)
    return e ? exerciseLabel(e) : 'Exercise'
  }

  function choose(id: string, kind: 'create' | 'skip') {
    const item = plan.find((p) => p.id === id)!
    resolutions[id] =
      kind === 'skip'
        ? { kind: 'skip' }
        : { kind: 'create', exercise: draftExercise(item.name, item.equipment, prefs.unit) }
  }

  function mapTo(exerciseId: number) {
    if (mapping) resolutions[mapping] = { kind: 'map', exerciseId }
    mapping = null
  }

  async function run() {
    if (!parsed) return
    busy = true
    try {
      const r = await importLegacy(parsed.sessions, $state.snapshot(resolutions), db, prefs.unit)
      result = { ...r, seeded: await seedRoutines() }
      parsed = null
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      busy = false
    }
  }

  const needsReview = $derived(plan.filter((p) => p.matchedId === undefined))
  const autoMatched = $derived(plan.length - needsReview.length)
</script>

<div class="row">
  <button class="btn" onclick={onback}>‹ Settings</button>
  <h1 class="grow" style="margin:0">Import history</h1>
</div>

<div class="vstack" style="margin-top:1rem">
  {#if mapping}
    <h2>Map to an existing Exercise</h2>
    <ExercisePicker onpick={mapTo} oncancel={() => (mapping = null)} />
  {:else if parsed}
    <div class="card">
      Read <strong>{parsed.sessions.length}</strong> Sessions.
      {#if autoMatched}{autoMatched} Exercises matched automatically.{/if}
    </div>

    {#if parsed.errors.length}
      <div class="card">
        <strong class="error">{parsed.errors.length} records could not be read</strong>
        {#each parsed.errors.slice(0, 8) as e}<div class="muted">{e.source}: {e.message}</div>{/each}
        {#if parsed.errors.length > 8}<div class="muted">…and {parsed.errors.length - 8} more</div>{/if}
      </div>
    {/if}
    {#if parsed.warnings.length}
      <div class="card muted">{parsed.warnings.length} sets or exercises were skipped as unusable.</div>
    {/if}

    {#if needsReview.length}
      <h2>Review {needsReview.length} unmatched Exercises</h2>
      {#each needsReview as item (item.id)}
        {@const r = resolutions[item.id]}
        <div class="card vstack">
          <div>
            <strong>{item.name}</strong>
            <span class="muted"> {item.equipment ?? ''} · {item.sets} sets</span>
          </div>
          <div class="chips">
            <button class="chip" class:on={r?.kind === 'create'} onclick={() => choose(item.id, 'create')}>Create new</button>
            <button class="chip" class:on={r?.kind === 'map'} onclick={() => (mapping = item.id)}>
              {r?.kind === 'map' ? `Map: ${label(r.exerciseId)}` : 'Map to existing…'}
            </button>
            <button class="chip" class:on={r?.kind === 'skip'} onclick={() => choose(item.id, 'skip')}>Skip</button>
          </div>
        </div>
      {/each}
    {/if}

    <button class="btn btn-primary btn-block" disabled={busy || parsed.sessions.length === 0} onclick={run}>
      Import {parsed.sessions.length} Sessions
    </button>
    <button class="btn btn-block" onclick={() => (parsed = null)}>Cancel</button>
  {:else}
    <p class="muted">
      Choose the session JSON files you exported from S3 (several at once, or a folder). Nothing leaves this
      phone. Importing the same files twice skips Sessions already imported.
    </p>
    <label class="btn btn-primary btn-block" style="display:grid;place-items:center">
      Choose files…
      <input type="file" accept="application/json,.json" multiple onchange={pick} hidden />
    </label>
    <label class="btn btn-block" style="display:grid;place-items:center">
      Choose a folder…
      <input type="file" webkitdirectory multiple onchange={pick} hidden />
    </label>
  {/if}

  {#if result}
    <div class="card vstack" role="status">
      <strong>Import finished</strong>
      <div>{result.imported} Sessions imported · {result.duplicates} already there</div>
      <div>{result.created} Exercises created{result.skippedExercises ? ` · ${result.skippedExercises} skipped` : ''}</div>
      {#if result.seeded.length}<div>Routines created for: {result.seeded.join(', ')}</div>{/if}
    </div>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>
