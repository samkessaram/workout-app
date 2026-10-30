<script lang="ts">
  import { backupFilename, exportAll, importAll, markExported, saveFile } from '../lib/backup'
  import { loadPrefs } from '../lib/settings.svelte'

  let { onback }: { onback: () => void } = $props()

  let message = $state('')
  let error = $state('')
  let pending = $state<string | null>(null)

  async function doExport() {
    error = ''
    try {
      saveFile(backupFilename(), JSON.stringify(await exportAll(), null, 2))
      await markExported()
      message = 'Backup saved to your downloads.'
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  async function pick(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    pending = await file.text()
    message = ''
    error = ''
  }

  async function confirmImport() {
    try {
      await importAll(pending!)
      await loadPrefs()
      message = 'Backup restored.'
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    pending = null
  }
</script>

<div class="row">
  <button class="btn" onclick={onback}>‹ Settings</button>
  <h1 class="grow" style="margin:0">Backup</h1>
</div>

<div class="vstack" style="margin-top:1rem">
  <p class="muted">All data lives on this phone. Export regularly: if the phone is lost, so is the data.</p>
  <button class="btn btn-primary btn-block" onclick={doExport}>Export backup</button>

  <label class="btn btn-block" style="display:grid;place-items:center">
    Restore from backup…
    <input type="file" accept="application/json,.json" onchange={pick} hidden />
  </label>

  {#if pending}
    <div class="card vstack" role="alertdialog">
      <strong>Replace everything on this phone with that backup?</strong>
      <div class="row">
        <button class="btn grow" onclick={() => (pending = null)}>Cancel</button>
        <button class="btn btn-error btn-outline grow" onclick={confirmImport}>Replace</button>
      </div>
    </div>
  {/if}

  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>
