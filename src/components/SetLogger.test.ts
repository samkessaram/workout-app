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

  describe('baseline question', () => {
    const suggestion = { weight: 180, unit: 'lb' as const, reps: 10, reason: 'test', rule: 'dp-hold', stage: 'EARLY_INT' as const }

    async function atNewGym(chooseWeight: string) {
      const { exId } = await setup()
      const sid = await startSession({ type: 'lower', location: 'new gym', trainer: false, timer: false })
      const exercise = (await db.exercises.get(exId))!
      const history = await exerciseHistory(exId, db, { excludeSessionId: sid })
      render(SetLogger, { exercise, session: (await db.sessions.get(sid))!, history, allHistory: history, suggestion })
      await fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${chooseWeight} lb`) }))
      await fireEvent.click(screen.getByRole('button', { name: /Log set/ }))
      return sid
    }

    it('asks once when the first Set at a new Location is 15%+ off, and stores the answer', async () => {
      // 180 suggested; the step-down chip is 175 (2.8% off), so reach 150 with the strip's +/-.
      const { exId } = await setup()
      const sid = await startSession({ type: 'lower', location: 'new gym', trainer: false, timer: false })
      const exercise = (await db.exercises.get(exId))!
      const history = await exerciseHistory(exId, db, { excludeSessionId: sid })
      render(SetLogger, { exercise, session: (await db.sessions.get(sid))!, history, allHistory: history, suggestion })
      for (let i = 0; i < 6; i++) await fireEvent.click(screen.getAllByRole('button', { name: 'Decrease' })[0]) // 180 -> 150
      await fireEvent.click(screen.getByRole('button', { name: /Log set · 150 lb/ }))
      await screen.findByText(/first time on this Exercise at/)
      await fireEvent.click(screen.getByRole('button', { name: /Feels different/ }))
      await waitFor(async () => expect((await db.sessions.get(sid))!.baselineAnswers).toEqual({ [exId]: 'new' }))
      expect(screen.queryByText(/first time on this Exercise at/)).toBeNull()
    })

    it('does not ask when the Set is close to the Suggestion', async () => {
      const sid = await atNewGym('175')
      await waitFor(async () => expect((await db.sessions.get(sid))!.sets).toHaveLength(1))
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.queryByText(/first time on this Exercise at/)).toBeNull()
    })

    it('does not ask at a Location where the Exercise was done before', async () => {
      const { exId } = await setup()
      const sid = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: false })
      const exercise = (await db.exercises.get(exId))!
      const history = await exerciseHistory(exId, db, { excludeSessionId: sid })
      render(SetLogger, { exercise, session: (await db.sessions.get(sid))!, history, allHistory: history, suggestion })
      for (let i = 0; i < 6; i++) await fireEvent.click(screen.getAllByRole('button', { name: 'Decrease' })[0])
      await fireEvent.click(screen.getByRole('button', { name: /Log set · 150 lb/ }))
      await waitFor(async () => expect((await db.sessions.get(sid))!.sets).toHaveLength(1))
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.queryByText(/first time on this Exercise at/)).toBeNull()
    })
  })
})
