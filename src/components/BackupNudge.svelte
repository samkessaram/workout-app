<script lang="ts">
  import { onMount } from 'svelte'
  import { backupNudge } from '../lib/backup'

  let { onopen }: { onopen?: () => void } = $props()
  let show = $state(false)
  onMount(async () => (show = await backupNudge()))
</script>

{#if show}
  <div class="card card-border bg-base-100 p-4 flex flex-wrap items-center gap-2" role="status">
    <span class="grow">It's been 2+ weeks since your last backup.</span>
    {#if onopen}<button class="btn btn-primary" onclick={onopen}>Back up</button>{/if}
  </div>
{/if}
