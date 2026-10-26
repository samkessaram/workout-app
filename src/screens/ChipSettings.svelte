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

<div class="row">
  <button class="btn" onclick={onback}>‹ Settings</button>
  <h1 class="grow" style="margin:0">Note chips</h1>
</div>
<div class="stack" style="margin-top:1rem">
  <p class="muted">Custom chips appear next to the built-in note chips on Sets and Exercises.</p>
  <div class="row">
    <input class="grow" type="text" placeholder="e.g. sore elbow" bind:value={text} />
    <button class="btn primary" disabled={!text.trim()} onclick={add}>Add</button>
  </div>
  <div class="chips">
    {#each prefs.customChips as c (c)}
      <button class="chip" aria-label={`Remove ${c}`} onclick={() => setCustomChips(prefs.customChips.filter((x) => x !== c))}>
        {c} ✕
      </button>
    {:else}
      <span class="muted">No custom chips yet.</span>
    {/each}
  </div>
</div>
