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
  <div class="card card-border bg-base-100 p-4 my-3" class:border-primary={view.done} role="timer" aria-live="off">
    <div class="flex flex-wrap items-center gap-2">
      <div class="grow">
        <div class="label whitespace-normal mb-1">{view.done ? `Rested (target ${fmtClock(t.total)})` : 'Resting'}</div>
        <div class="text-4xl tabular-nums">{view.done ? fmtClock(view.elapsed) : fmtClock(view.left)}</div>
      </div>
      <div class="flex gap-2">
        {#each [60, 90, 120] as s}
          <button class="btn" class:btn-primary={t.total === s} onclick={() => startRest(s, t.startedAt)}>{s}s</button>
        {/each}
      </div>
      <button class="btn" onclick={clearRest}>Skip</button>
    </div>
  </div>
{/if}
