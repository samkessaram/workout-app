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
  <div class="card card-border bg-base-100 p-4 grid grid-cols-1 gap-3">
    <div class="label whitespace-normal mb-1">How does it feel?</div>
    <Chips options={['sharp', 'dull'] as const} selected={severity} onpick={(v) => (severity = v)} />
    <div class="label whitespace-normal mb-1">What now?</div>
    <Chips options={['stop', 'continue'] as const} selected={action} onpick={(v) => (action = v)} />
    <div class="label whitespace-normal mb-1">Where (optional)</div>
    <Chips options={options} selected={area} onpick={(a) => (area = area === a ? undefined : a)} />
    <div class="flex flex-wrap items-center gap-2">
      <button class="btn grow" onclick={() => (open = false)}>Cancel</button>
      <button class="btn btn-error btn-outline grow" onclick={save}>Flag pain</button>
    </div>
  </div>
{:else}
  <button class="btn" onclick={() => (open = true)}>⚠ Pain</button>
{/if}
