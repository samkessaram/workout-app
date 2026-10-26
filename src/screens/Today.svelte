<script lang="ts">
  import { onMount } from 'svelte'
  import { getActiveSession } from '../lib/sessions'
  import SessionSummary from '../components/SessionSummary.svelte'
  import StartForm from '../components/StartForm.svelte'
  import SessionView from './SessionView.svelte'

  let ready = $state(false)
  let activeId = $state<number | null>(null)
  let summaryId = $state<number | null>(null)

  onMount(async () => {
    activeId = (await getActiveSession())?.id ?? null
    ready = true
  })
</script>

{#if !ready}
  <!-- loading -->
{:else if summaryId !== null}
  <SessionSummary sessionId={summaryId} ondone={() => (summaryId = null)} />
{:else if activeId !== null}
  <SessionView
    sessionId={activeId}
    onclosed={() => {
      summaryId = activeId
      activeId = null
    }}
  />
{:else}
  <h1>Today</h1>
  <StartForm onstarted={(id) => (activeId = id)} />
{/if}
