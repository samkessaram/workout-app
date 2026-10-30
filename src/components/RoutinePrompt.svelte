<script lang="ts">
  import { db, type Exercise, type Routine } from '../lib/db'
  import { exerciseLabel } from '../lib/exercises'
  import { applyDiff, saveRoutine, type RoutineDiff } from '../lib/routines'

  let {
    routine,
    diff,
    exercises,
    ondone,
  }: { routine: Routine; diff: RoutineDiff; exercises: Exercise[]; ondone: () => void } = $props()

  const names = (ids: number[]) =>
    ids.map((id) => exercises.find((e) => e.id === id)).filter((e): e is Exercise => !!e).map(exerciseLabel)

  async function update() {
    await saveRoutine(applyDiff(routine, diff, exercises), db)
    ondone()
  }
</script>

<h2>Update the {routine.sessionType} Routine?</h2>
<div class="vstack">
  {#if diff.added.length}<p class="card">Added: {names(diff.added).join(', ')}</p>{/if}
  {#if diff.skipped.length}<p class="card">Skipped: {names(diff.skipped).join(', ')}</p>{/if}
  <button class="btn btn-primary btn-block" onclick={update}>Update Routine</button>
  <button class="btn btn-block" onclick={ondone}>Keep as is</button>
</div>
