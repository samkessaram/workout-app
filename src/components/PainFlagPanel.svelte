<script lang="ts">
  import type { Exercise, PainFlag } from '../lib/db'
  import { BODY_AREAS } from '../lib/exercises'
  import { areasOf, raiseFlag } from '../lib/pain'
  import Chips from './Chips.svelte'

  let { exercise }: { exercise: Exercise } = $props()

  let open = $state(false)
  let severity = $state<PainFlag['severity']>('dull')
  let action = $state<PainFlag['action']>('continue')
  let area = $state<string | undefined>()

  const options = $derived([...new Set([...areasOf(exercise), ...BODY_AREAS])])

  async function save() {
    await raiseFlag({ exerciseId: exercise.id!, severity, action, bodyArea: area })
    open = false
    severity = 'dull'
    action = 'continue'
    area = undefined
  }
</script>

{#if open}
  <div class="card stack">
    <div class="label">How does it feel?</div>
    <Chips options={['sharp', 'dull'] as const} selected={severity} onpick={(v) => (severity = v)} />
    <div class="label">What now?</div>
    <Chips options={['stop', 'continue'] as const} selected={action} onpick={(v) => (action = v)} />
    <div class="label">Where (optional)</div>
    <Chips options={options} selected={area} onpick={(a) => (area = area === a ? undefined : a)} />
    <div class="row">
      <button class="btn grow" onclick={() => (open = false)}>Cancel</button>
      <button class="btn danger grow" onclick={save}>Flag pain</button>
    </div>
  </div>
{:else}
  <button class="chip" onclick={() => (open = true)}>⚠ Pain</button>
{/if}
