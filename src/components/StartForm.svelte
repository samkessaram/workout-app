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

<div class="grid grid-cols-1 gap-3">
  <div>
    <div class="label whitespace-normal mb-1">Session type</div>
    <Chips options={SESSION_TYPES} selected={type} onpick={(t) => (type = t)} />
  </div>
  <div>
    <div class="label whitespace-normal mb-1">Location</div>
    <Chips options={LOCATIONS} selected={location} onpick={(l) => (location = l)} />
  </div>
  <div>
    <div class="label whitespace-normal mb-1">With a trainer</div>
    <Chips options={['no', 'yes']} selected={trainer ? 'yes' : 'no'} onpick={(v) => setTrainer(v === 'yes')} />
  </div>
  <div>
    <div class="label whitespace-normal mb-1">Rest timer</div>
    <Chips options={['on', 'off']} selected={timer ? 'on' : 'off'} onpick={(v) => (timer = v === 'on')} />
  </div>
  <button class="btn btn-primary btn-block" onclick={start}>Start Session</button>
</div>
