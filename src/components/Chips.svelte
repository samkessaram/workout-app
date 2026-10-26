<script lang="ts" generics="T extends string | number">
  let {
    options,
    selected,
    onpick,
    fmt = (o: T) => String(o),
    recommended,
  }: {
    options: T[]
    selected: T | T[] | undefined
    onpick: (o: T) => void
    fmt?: (o: T) => string
    recommended?: T
  } = $props()

  const isOn = (o: T) => (Array.isArray(selected) ? selected.includes(o) : selected === o)
</script>

<div class="chips">
  {#each options as o (o)}
    <button type="button" class="chip" class:on={isOn(o)} class:rec={recommended === o} onclick={() => onpick(o)}>
      {fmt(o)}
    </button>
  {/each}
</div>
