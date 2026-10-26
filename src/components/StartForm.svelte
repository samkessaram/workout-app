<script lang="ts">
  import type { SessionType } from '../lib/db'
  import { clearRest } from '../lib/rest.svelte'
  import { LOCATIONS, SESSION_TYPES, startSession } from '../lib/sessions'
  import Chips from './Chips.svelte'

  let { onstarted }: { onstarted: (id: number) => void } = $props()

  let type = $state<SessionType>('lower')
  let location = $state(LOCATIONS[0])
  let trainer = $state(false)
  let timer = $state(true)

  function setTrainer(v: boolean) {
    trainer = v
    timer = !v
  }

  async function start() {
    clearRest()
    onstarted(await startSession({ type, location, trainer, timer }))
  }
</script>

<div class="stack">
  <div>
    <div class="label">Session type</div>
    <Chips options={SESSION_TYPES} selected={type} onpick={(t) => (type = t)} />
  </div>
  <div>
    <div class="label">Location</div>
    <Chips options={LOCATIONS} selected={location} onpick={(l) => (location = l)} />
  </div>
  <div>
    <div class="label">With a trainer</div>
    <Chips options={['no', 'yes']} selected={trainer ? 'yes' : 'no'} onpick={(v) => setTrainer(v === 'yes')} />
  </div>
  <div>
    <div class="label">Rest timer</div>
    <Chips options={['on', 'off']} selected={timer ? 'on' : 'off'} onpick={(v) => (timer = v === 'on')} />
  </div>
  <button class="btn primary block" onclick={start}>Start Session</button>
</div>
