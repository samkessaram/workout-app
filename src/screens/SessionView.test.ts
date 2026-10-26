// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../lib/db'
import { newExercise, saveExercise } from '../lib/exercises'
import { rest } from '../lib/rest.svelte'
import { entryFor, saveRoutine } from '../lib/routines'
import { addSet, closeSession, startSession } from '../lib/sessions'
import { prefs } from '../lib/settings.svelte'
import SessionView from './SessionView.svelte'

afterEach(async () => {
  cleanup()
  await db.delete()
  await db.open()
  prefs.unit = 'lb'
  rest.timer = null
})

async function setup(trainer: boolean) {
  const exId = await saveExercise({ ...newExercise('lb'), name: 'Leg Press', equipment: 'machine', kind: 'machine', restCategory: 'moderate', repMin: 8, repMax: 12 })
  await saveRoutine({ sessionType: 'lower', entries: [entryFor((await db.exercises.get(exId))!)] })
  for (let i = 1; i <= 3; i++) {
    const p = await startSession({ type: 'lower', location: 'gym', trainer: false, timer: true }, db, i * 1000)
    for (let k = 0; k < 3; k++) await addSet(p, { exerciseId: exId, weight: 100, unit: 'lb', reps: 12, warmup: false }, db, i * 1000)
    await closeSession(p, db, i * 1000)
  }
  const sid = await startSession({ type: 'lower', location: 'gym', trainer, timer: !trainer }, db, 10_000)
  return { exId, sid }
}

describe('SessionView coaching', () => {
  it('shows the Brief and a Suggestion with its reason, and logs the Suggestion', async () => {
    const { sid } = await setup(false)
    render(SessionView, { sessionId: sid, onclosed: () => {} })
    await screen.findByText("Today's Suggestions")
    expect(screen.getAllByText(/Add 5 lb and restart at 8 reps/).length).toBeGreaterThan(0)
    await fireEvent.click(screen.getByRole('button', { name: /Leg Press/ }))
    await screen.findByText(/Suggestion:/)
    // The recommended chip is the suggested weight, one tap logs it.
    await fireEvent.click(await screen.findByRole('button', { name: /Log set · 105 lb × 8/ }))
    await waitFor(async () => expect((await db.sessions.get(sid))!.sets).toHaveLength(1))
    await waitFor(async () => {
      const [entry] = await db.suggestionLog.toArray()
      expect(entry).toMatchObject({ rule: 'dp-increase', stage: 'EARLY_INT' })
      expect(entry.actual).toEqual([{ weight: 105, unit: 'lb', reps: 8 }])
    })
  })

  it('shows no Brief, Suggestion or suggestionLog entry in trainer mode', async () => {
    const { sid } = await setup(true)
    render(SessionView, { sessionId: sid, onclosed: () => {} })
    const press = await screen.findByRole('button', { name: /Leg Press/ })
    expect(screen.queryByText('Brief')).toBeNull()
    await fireEvent.click(press)
    await screen.findByText('Weight')
    expect(screen.queryByText(/Suggestion:/)).toBeNull()
    await fireEvent.click(await screen.findByRole('button', { name: /Log set/ }))
    await waitFor(async () => expect((await db.sessions.get(sid))!.sets).toHaveLength(1))
    expect(await db.suggestionLog.count()).toBe(0)
    expect(rest.timer).toBeNull()
  })
})
