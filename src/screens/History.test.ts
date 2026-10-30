// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../lib/db'
import { newExercise, saveExercise } from '../lib/exercises'
import { addSet, closeSession, correctSet, startSession } from '../lib/sessions'
import History from './History.svelte'

afterEach(async () => {
  cleanup()
  await db.delete()
  await db.open()
})

async function seed() {
  const exId = await saveExercise({ ...newExercise('lb'), name: 'Leg Press', equipment: 'machine' })
  const log = async (when: number, location: string, sets: [number, number, boolean?][]) => {
    const sid = await startSession({ type: 'lower', location, trainer: false, timer: false }, db, when)
    const out = []
    for (const [weight, reps, warmup] of sets) out.push(await addSet(sid, { exerciseId: exId, weight, unit: 'lb', reps, warmup: !!warmup }, db, when))
    await closeSession(sid, db, when)
    return { sid, sets: out }
  }
  const first = await log(Date.parse('2026-01-05T12:00:00'), 'gym', [[100, 10], [100, 9]])
  const last = await log(Date.parse('2026-01-12T12:00:00'), 'new gym', [[60, 10, true], [180, 10], [180, 9]])
  return { exId, first, last }
}

describe('History', () => {
  it('lists Sessions newest first and opens one with its Sets, warmups distinct', async () => {
    await seed()
    render(History)
    const rows = await screen.findAllByRole('button', { name: /lower/ })
    expect(rows[0].textContent).toContain('2026-01-12')
    expect(rows[1].textContent).toContain('2026-01-05')
    await fireEvent.click(rows[0])
    await screen.findByText(/Warmup: 60 lb × 10/)
    expect(screen.getByText(/Set 1: 180 lb × 10/)).toBeTruthy()
    expect(screen.getByText(/Set 2: 180 lb × 9/)).toBeTruthy()
  })

  it("answers 'what did I do last time' only from stored records, with Exercise progress", async () => {
    await seed()
    render(History)
    await fireEvent.click(await screen.findByRole('button', { name: 'Exercises' }))
    await fireEvent.click(await screen.findByRole('button', { name: /Leg Press/ }))
    await screen.findByText(/Last time \(2026-01-12, new gym\)/)
    expect(screen.getAllByText(/180 lb × 10, 9 \+ 1 warmup/).length).toBeGreaterThan(0)
    expect(screen.getByText(/100 lb × 10, 9/)).toBeTruthy()
  })

  it('shows a Correction as the new value with the previous one visible', async () => {
    const { last } = await seed()
    await correctSet(last.sid, last.sets[1].id, { weight: 170, unit: 'lb', reps: 10 })
    render(History)
    await fireEvent.click((await screen.findAllByRole('button', { name: /lower/ }))[0])
    await screen.findByText(/Set 1: 170 lb × 10/)
    expect(screen.getByText(/corrected from 180 lb × 10/)).toBeTruthy()
  })

  it('deletes a Session after confirmation and drops it from history', async () => {
    await seed()
    render(History)
    await fireEvent.click((await screen.findAllByRole('button', { name: /lower/ }))[0])
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete Session' }))
    await fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(await db.sessions.count()).toBe(2)
    await fireEvent.click(screen.getByRole('button', { name: 'Delete Session' }))
    await fireEvent.click(await screen.findByRole('button', { name: 'Yes, delete' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: /lower/ })).toHaveLength(1))
    expect(screen.getByRole('button', { name: /lower/ }).textContent).toContain('2026-01-05')
    expect(await db.sessions.count()).toBe(1)
  })

  it('says so when there is nothing yet', async () => {
    render(History)
    await screen.findByText('No Sessions yet.')
  })
})
