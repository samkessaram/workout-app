<script lang="ts">
  import { onDestroy } from 'svelte'
  import { buzz } from '../lib/feedback'
  import { fmtClock, restView } from '../lib/rest'
  import { clearRest, rest, startRest } from '../lib/rest.svelte'

  let now = $state(Date.now())
  const timer = setInterval(() => (now = Date.now()), 250)
  onDestroy(() => clearInterval(timer))

  const t = $derived(rest.timer)
  const view = $derived(t ? restView(t, now) : null)

  // Buzz once as the countdown reaches zero while the app is in front. A late return
  // (backgrounded past zero) just shows the actual rest.
  let buzzedFor = 0
  $effect(() => {
    if (t && view?.done && buzzedFor !== t.startedAt) {
      buzzedFor = t.startedAt
      if (now - (t.startedAt + t.total * 1000) < 2000) buzz()
    }
  })
</script>

{#if t && view}
  <div class="card timer" class:done={view.done} role="timer" aria-live="off">
    <div class="row">
      <div class="grow">
        <div class="label">{view.done ? `Rested (target ${fmtClock(t.total)})` : 'Resting'}</div>
        <div class="clock">{view.done ? fmtClock(view.elapsed) : fmtClock(view.left)}</div>
      </div>
      <div class="presets">
        {#each [60, 90, 120] as s}
          <button class="chip" class:on={t.total === s} onclick={() => startRest(s, t.startedAt)}>{s}s</button>
        {/each}
      </div>
      <button class="btn" onclick={clearRest}>Skip</button>
    </div>
  </div>
{/if}

<style>
  .timer { margin: 0.75rem 0; }
  .timer.done { border-color: var(--accent); }
  .clock { font-size: 2.6rem; font-weight: 500; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .presets { display: flex; gap: 0.4rem; }
</style>
