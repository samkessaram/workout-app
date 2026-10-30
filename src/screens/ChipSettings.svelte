<script lang="ts">
  import { withCustomChip } from '../lib/chips'
  import { prefs, setCustomChips } from '../lib/settings.svelte'

  let { onback }: { onback: () => void } = $props()
  let text = $state('')

  async function add() {
    await setCustomChips(withCustomChip(prefs.customChips, text))
    text = ''
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  <button class="btn" onclick={onback}>‹ Settings</button>
  <h1 class="grow" style="margin:0">Note chips</h1>
</div>
<div class="grid grid-cols-1 gap-3" style="margin-top:1rem">
  <p class="text-base-content/60 text-sm">Custom chips appear next to the built-in note chips on Sets and Exercises.</p>
  <div class="flex flex-wrap items-center gap-2">
    <input class="input grow" type="text" placeholder="e.g. sore elbow" bind:value={text} />
    <button class="btn btn-primary" disabled={!text.trim()} onclick={add}>Add</button>
  </div>
  <div class="flex flex-wrap gap-2">
    {#each prefs.customChips as c (c)}
      <button class="btn" aria-label={`Remove ${c}`} onclick={() => setCustomChips(prefs.customChips.filter((x) => x !== c))}>
        {c} ✕
      </button>
    {:else}
      <span class="text-base-content/60 text-sm">No custom chips yet.</span>
    {/each}
  </div>
</div>
