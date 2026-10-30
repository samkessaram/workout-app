<script lang="ts">
  import { roundTo } from '../lib/units'

  let {
    value,
    step,
    min = 0,
    max = Infinity,
    onchange,
    fmt = (n: number) => String(n),
  }: {
    value: number
    step: number
    min?: number
    max?: number
    onchange: (n: number) => void
    fmt?: (n: number) => string
  } = $props()

  const items = $derived.by(() => {
    const out: number[] = []
    for (let k = -10; k <= 10; k++) {
      const v = roundTo(value + k * step, step)
      if (v >= min && v <= max && !out.includes(v)) out.push(v)
    }
    return out
  })

  let strip: HTMLDivElement | undefined = $state()

  $effect(() => {
    value
    items
    strip?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
    })
  })

  const nudge = (dir: 1 | -1) => {
    const v = roundTo(value + dir * step, step)
    if (v >= min && v <= max) onchange(v)
  }
</script>

<div class="wrap">
  <button type="button" class="btn nudge" aria-label="Decrease" onclick={() => nudge(-1)}>−</button>
  <div class="strip" bind:this={strip}>
    {#each items as v (v)}
      <button type="button" class="cell" aria-pressed={v === value} onclick={() => onchange(v)}>{fmt(v)}</button>
    {/each}
  </div>
  <button type="button" class="btn nudge" aria-label="Increase" onclick={() => nudge(1)}>+</button>
</div>

<style>
  .wrap { display: flex; gap: 0.4rem; align-items: stretch; }
  .nudge { padding: 0; width: var(--tap); flex: none; font-size: 1.4rem; }
  .strip {
    flex: 1;
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
  }
  .strip::-webkit-scrollbar { display: none; }
</style>
