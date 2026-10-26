// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../lib/db'
import { exerciseHistory } from '../lib/history'
import { addSet, closeSession, startSession } from '../lib/sessions'
import { newExercise, saveExercise } from '../lib/exercises'
import { prefs } from '../lib/settings.svelte'
import { rest } from '../lib/rest.svelte'
import { getSetting } from '../lib/settings.svelte'
import SetLogger from './SetLogger.svelte'

afterEach(async () => {
  cleanup()
  await db.delete()
  await db.open()
  prefs.unit = 'lb'
  rest.timer = null
})

async function setup() {
  const exId = await saveExercise({ ...newExercise('lb'), name: 'Leg Press', equipment: 'machine', kind: 'machine', restCategory: 'moderate', repMin: 8, repMax: 12 })
  const prev = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: true })
  await addSet(prev, { exerciseId: exId, weight: 180, unit: 'lb', reps: 10, warmup: false })
  await closeSession(prev)
  const sid = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: true })
  return { exId, sid }
}

async function mountLogger(exId: number, sid: number) {
  const exercise = (await db.exercises.get(exId))!
  const session = (await db.sessions.get(sid))!
  const history = await exerciseHistory(exId, db, { excludeSessionId: sid })
  return render(SetLogger, { exercise, session, history })
}

describe('SetLogger', () => {
  it('logs a Set that matches the recommendation in one tap', async () => {
    const { exId, sid } = await setup()
    await mountLogger(exId, sid)
    // Recommended weight is the last working weight, pre-selected.
    expect(screen.getByRole('button', { name: /Log set · 180 lb × 10/ })).toBeTruthy()
    await fireEvent.click(screen.getByRole('button', { name: /Log set/ }))
    await waitFor(async () => {
      const s = await db.sessions.get(sid)
      expect(s!.sets).toHaveLength(1)
      expect(s!.sets[0]).toMatchObject({ weight: 180, unit: 'lb', reps: 10, warmup: false })
    })
  })

  it('logs a one-step change in two taps and flags warmups', async () => {
    const { exId, sid } = await setup()
    await mountLogger(exId, sid)
    await fireEvent.click(screen.getByRole('button', { name: '185 lb' }))
    await fireEvent.click(screen.getByRole('button', { name: /Log set · 185 lb/ }))
    await waitFor(async () => expect((await db.sessions.get(sid))!.sets[0].weight).toBe(185))
  })

  it('stores a warmup distinctly', async () => {
    const { exId, sid } = await setup()
    await mountLogger(exId, sid)
    await fireEvent.click(screen.getByRole('button', { name: 'Warmup' }))
    await fireEvent.click(screen.getByRole('button', { name: /Log warmup/ }))
    await waitFor(async () => expect((await db.sessions.get(sid))!.sets[0].warmup).toBe(true))
  })

  it('says so when there is no history', async () => {
    const exId = await saveExercise({ ...newExercise('lb'), name: 'Hack Squat', equipment: 'machine' })
    const sid = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: true })
    await mountLogger(exId, sid)
    expect(screen.getByText(/No history for this Exercise yet/)).toBeTruthy()
  })

  it('starts the rest timer after a working Set but not after a warmup', async () => {
    const { exId, sid } = await setup()
    await mountLogger(exId, sid)
    await fireEvent.click(screen.getByRole('button', { name: 'Warmup' }))
    await fireEvent.click(screen.getByRole('button', { name: /Log warmup/ }))
    await waitFor(async () => expect((await db.sessions.get(sid))!.sets).toHaveLength(1))
    expect(rest.timer).toBeNull()
    await fireEvent.click(screen.getByRole('button', { name: /Log set/ }))
    await waitFor(() => expect(rest.timer?.total).toBe(90)) // machine Exercise: moderate rest
    // The timer must survive an app kill, so it has to reach IndexedDB.
    await waitFor(async () => expect(await getSetting('restTimer', null)).toMatchObject({ total: 90 }))
  })
})
