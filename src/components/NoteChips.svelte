<script lang="ts">
  import { allChips, CONFOUNDER_CHIPS, NOTE_CHIPS } from '../lib/chips'
  import { prefs } from '../lib/settings.svelte'
  import Chips from './Chips.svelte'

  let {
    chips,
    note = '',
    ontoggle,
    onnote,
    summary = 'Notes',
  }: {
    chips: string[]
    note?: string
    ontoggle: (chip: string) => void
    onnote: (text: string) => void
    summary?: string
  } = $props()

  let open = $state(false)
  let showText = $state(false)
  // svelte-ignore state_referenced_locally
  let draft = $state(note)

  const count = $derived(chips.length + (note ? 1 : 0))
</script>

<div>
  <button class="btn" class:btn-primary={count > 0} aria-expanded={open} onclick={() => (open = !open)}>
    {summary}{count ? ` · ${count}` : ''}
  </button>
  {#if !open && (chips.length || note)}
    <span class="text-base-content/60 text-sm"> {[...chips, note].filter(Boolean).join(', ')}</span>
  {/if}
</div>

{#if open}
  <div class="grid grid-cols-1 gap-3" style="margin:0.5rem 0">
    <div class="label whitespace-normal mb-1">Notes</div>
    <Chips options={[...NOTE_CHIPS, ...prefs.customChips]} selected={chips} onpick={ontoggle} />
    <div class="label whitespace-normal mb-1">Confounders (a stall with one of these does not count)</div>
    <Chips options={CONFOUNDER_CHIPS} selected={chips} onpick={ontoggle} />
    {#if showText || note}
      <textarea class="textarea w-full"
        placeholder="Optional note"
        bind:value={draft}
        onblur={() => onnote(draft)}
      ></textarea>
    {:else}
      <button class="btn" onclick={() => (showText = true)}>+ Add text</button>
    {/if}
  </div>
{/if}
